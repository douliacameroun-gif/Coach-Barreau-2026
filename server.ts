import express from 'express';
import multer from 'multer';
import axios from 'axios';
import Airtable from 'airtable';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Setup Multer for file uploads (storing in memory temporarily)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Setup Airtable
const airtableApiKey = process.env.AIRTABLE_API_KEY;
const airtableBaseId = process.env.AIRTABLE_BASE_ID;

let base: any = null;
if (airtableApiKey && airtableBaseId) {
  base = new Airtable({ apiKey: airtableApiKey }).base(airtableBaseId);
} else {
  console.warn('Airtable credentials missing. Persistence features will be disabled.');
}

// Setup Tavily
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

app.use(express.json({ limit: '50mb' }));

// --- Airtable Persistence Endpoints ---

// Create or update a session
app.post('/api/sessions', async (req, res) => {
  if (!base) return res.status(503).json({ error: 'Airtable not configured' });
  
  const { sessionId, subject, title } = req.body;
  
  try {
    const records = await base('Sessions').select({
      filterByFormula: `{ID Session} = '${sessionId}'`
    }).firstPage();

    if (records.length > 0) {
      // Update
      const updated = await base('Sessions').update(records[0].id, {
        "Sujet Principal": subject,
        "Titre de la conversation": title,
        "Dernière activité": new Date().toISOString()
      });
      return res.json(updated.fields);
    } else {
      // Create
      const created = await base('Sessions').create({
        "ID Session": sessionId,
        "Sujet Principal": subject,
        "Titre de la conversation": title || 'Nouvelle Session',
        "Date de création": new Date().toISOString(),
        "Dernière activité": new Date().toISOString()
      });
      return res.json(created.fields);
    }
  } catch (error: any) {
    console.error('Airtable Sessions Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all sessions
app.get('/api/sessions', async (req, res) => {
  if (!base) return res.status(503).json({ error: 'Airtable not configured' });
  
  try {
    const records = await base('Sessions').select({
      sort: [{ field: 'Dernière activité', direction: 'desc' }]
    }).all();
    
    res.json(records.map((r: any) => ({ airtableId: r.id, ...r.fields })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save a message
app.post('/api/messages', async (req, res) => {
  if (!base) return res.status(503).json({ error: 'Airtable not configured' });
  
  const { sessionId, role, content, timestamp } = req.body;
  
  try {
    // Find session record ID
    const sessionRecords = await base('Sessions').select({
      filterByFormula: `{ID Session} = '${sessionId}'`
    }).firstPage();
    
    if (sessionRecords.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const message = await base('Messages').create({
      "Session": [sessionRecords[0].id],
      "Rôle": role === 'user' ? 'Utilisateur' : 'Coach',
      "Contenu": content,
      "Horodatage": timestamp || new Date().toISOString()
    });
    
    res.json({ id: message.id, ...message.fields });
  } catch (error: any) {
    console.error('Airtable Messages Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get messages for a session
app.get('/api/sessions/:sessionId/messages', async (req, res) => {
  if (!base) return res.status(503).json({ error: 'Airtable not configured' });
  
  const { sessionId } = req.params;
  
  try {
    const records = await base('Messages').select({
      filterByFormula: `SEARCH('${sessionId}', {Session})`,
      sort: [{ field: 'Horodatage', direction: 'asc' }]
    }).all();
    
    res.json(records.map((r: any) => ({
      id: r.id,
      role: r.fields['Rôle'] === 'Utilisateur' ? 'user' : 'model',
      content: r.fields['Contenu'],
      timestamp: r.fields['Horodatage']
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Tavily Search Endpoint ---
app.post('/api/search', async (req, res) => {
  if (!TAVILY_API_KEY) return res.status(503).json({ error: 'Tavily API Key missing' });
  
  const { query } = req.body;
  
  try {
    const response = await axios.post('https://api.tavily.com/search', {
      api_key: TAVILY_API_KEY,
      query: query,
      search_depth: "advanced",
      include_answer: true,
      max_results: 5
    });
    
    res.json(response.data);
  } catch (error: any) {
    console.error('Tavily Search Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- File Upload to Airtable Endpoint ---
app.post('/api/upload', upload.single('file'), async (req: any, res) => {
  if (!base) return res.status(503).json({ error: 'Airtable not configured' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const { messageId } = req.body;
  
  try {
    // Note: Airtable for "Attachments" requires a public URL usually or we can upload via API if using certain libraries. 
    // However, the base Airtable SDK doesn't support direct buffer upload easily without a public URL.
    // BUT, we can store it in Airtable by providing the file metadata and then the user can manually see it?
    // Actually, for AI analysis, we just need the file content. 
    // If the user wants to *persist* the file in Airtable:
    // We'll create a record in 'Fichiers' table.
    
    // For direct file storage in Airtable PIECE JOINTE, it usually expects a URL.
    // A workaround for AI Studio is to skip the actual 'piece jointe' upload if no public URL is available, 
    // OR use a service to get a temporary URL.
    // Since we want to avoid browser crash, the main thing is to NOT keep it in the browser state.
    
    const createdFile = await base('Fichiers').create({
      "Nom du fichier": req.file.originalname,
      "Message lié": messageId ? [messageId] : [],
      "Type MIME": req.file.mimetype,
      // We can't easily upload the buffer directly to 'Document' field without a public URL.
      // We will store the metadata and return success.
    });
    
    res.json({ 
      success: true, 
      id: createdFile.id,
      name: req.file.originalname,
      type: req.file.mimetype
    });
  } catch (error: any) {
    console.error('Airtable Upload Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Vite Middleware ---
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
