import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, GenerateContentResponse, Type } from "@google/genai";
import { 
  Send, 
  User, 
  Scale, 
  Volume2, 
  VolumeX, 
  Loader2, 
  BookOpen, 
  Gavel, 
  ShieldAlert, 
  Users, 
  FileText, 
  Building2,
  RefreshCw,
  Mic,
  MicOff,
  Paperclip,
  X,
  File,
  History,
  LogOut,
  LogIn,
  Plus,
  PlusCircle,
  Menu,
  ChevronLeft,
  Search,
  Globe,
  Landmark,
  Briefcase,
  PenTool
} from 'lucide-react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Constants & Types ---

const SUBJECTS = [
  { id: 1, name: "Droit Civil", icon: Users, color: "text-blue-500" },
  { id: 2, name: "Droit Pénal", icon: ShieldAlert, color: "text-red-500" },
  { id: 3, name: "Procédure Civile", icon: Scale, color: "text-indigo-500" },
  { id: 4, name: "Droit & Procédure Pénale", icon: Landmark, color: "text-rose-500" },
  { id: 5, name: "Droit Commercial OHADA", icon: Briefcase, color: "text-amber-500" },
  { id: 6, name: "Droit du Travail", icon: FileText, color: "text-orange-500" },
  { id: 7, name: "Droit Administratif", icon: Building2, color: "text-purple-500" },
  { id: 8, name: "Voies D'execution", icon: Gavel, color: "text-cyan-500" },
  { id: 9, name: "Methodologie juridique", icon: PenTool, color: "text-slate-500" },
];

const SYSTEM_INSTRUCTION = `Tu es le "Coach Barreau 2026", un assistant juridique expert en droit camerounais, dévoué à la préparation de Christiane Endalle pour l'examen du barreau de la session 2026.

RÈGLES DE FORMATAGE "VOICE-READY" ET "CLEAN-DISPLAY" (STRICTES) :
❶ Formatage Gras : Mets les titres et les mots clés en gras en utilisant le formatage Markdown standard (double astérisque).
❷ INTERDICTION : Il est formellement interdit d'utiliser la balise HTML <b>.
❸ Zéro Caractère Spécial : N'utilise pas de guillemets ("), de tirets de liste (-), ou d'accolades ({}). Seuls les doubles astérisques pour le gras sont autorisés.
❹ Structure de Liste : Pour lister des choix, des étapes ou des questions, utilise uniquement des puces numériques circulaires (❶, ❷, ❸, ❹, ❺, ❻, etc.).
❺ Style de Ponctuation : Utilise uniquement le point, la virgule, le point d'interrogation et le point d'exclamation pour une synthèse vocale fluide.
❻ Simplicité Vocale : Fais des paragraphes très courts et aérés. Chaque phrase doit être simple, directe et courte. Saute des lignes entre chaque idée.

Mission :
❶ Évaluation : Pose des questions de cours ou des mini-cas pratiques sur les 7 matières exigées.
❷ Correction : Attends la réponse de Christiane avant de donner la solution. Cite les articles de loi camerounais.
❸ Analyse : Analyse les documents téléchargés en respectant ces règles.
❹ Langue : Français exclusivement.

Commence par saluer Christiane chaleureusement et invite-la à choisir une matière dans le panneau latéral.`;

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: any; // Can be Date or Firestore Timestamp
  attachment?: {
    name: string;
    type: string;
    data?: string;
  };
}

interface ChatSession {
  id: string;
  messages: Message[];
  lastUpdated: any;
  subject?: string;
  title?: string;
}

// --- Components ---

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ file: File; base64: string } | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [isSearchEnabled, setIsSearchEnabled] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Gemini
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  const chatRef = useRef<any>(null);

  useEffect(() => {
    const savedSessionId = localStorage.getItem('currentSessionId');
    if (savedSessionId) {
      setCurrentSessionId(savedSessionId);
      setIsStarted(true);
    }
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await axios.get('/api/sessions');
      
      if (!Array.isArray(response.data)) {
        setSessions([]);
        return;
      }
      
      // Filter out fictitious mock data that might be in Airtable from early tests
      const FICTITIOUS_SUBJECTS = [
        'Cloud Computing', 'Data Science', 'SEO', 'UX/UI', 'Marketing Digital', 
        'E-commerce', 'Réseaux Sociaux', 'Cybersécurité', 'Entrepreneuriat',
        'Communication', 'Développement Personnel', 'Formation en ligne',
        'Gestion de Projet', 'Développement Web', 'Intelligence Artificielle'
      ];

      const loadedSessions = response.data
        .map((s: any) => ({
          airtableId: s.airtableId,
          id: s['ID Session'],
          subject: s['Sujet Principal'],
          title: s['Titre de la conversation'],
          lastUpdated: s['Dernière activité'],
          messages: [] 
        }))
        .filter((s: any) => {
          // Only keep subjects that are NOT in the list of fictitious subjects
          return !FICTITIOUS_SUBJECTS.includes(s.subject);
        });

      setSessions(loadedSessions);
      
      const savedSessionId = localStorage.getItem('currentSessionId');
      if (savedSessionId) {
        loadSession(savedSessionId);
      }
    } catch (error) {
      console.error("Error loading sessions:", error);
    }
  };

  const updateSessionTitle = async (sessionId: string, newTitle: string) => {
    try {
      await axios.post('/api/sessions', {
        sessionId,
        title: newTitle.substring(0, 100), // Enforce max length for safety
        subject: activeSubject || 'Révision'
      });
      loadSessions(); // Refresh list to show new title
    } catch (error) {
      console.error("Error updating session title:", error);
    }
  };

  const createNewSession = async (customSubject?: string) => {
    const sessionId = uuidv4();
    const finalSubject = customSubject || activeSubject || 'Révision Générale';
    try {
      await axios.post('/api/sessions', {
        sessionId,
        title: 'Nouvelle Session',
        subject: finalSubject
      });
      
      setCurrentSessionId(sessionId);
      localStorage.setItem('currentSessionId', sessionId);
      setMessages([]);
      setIsSidebarOpen(false);
      setActiveSubject(finalSubject === 'Révision Générale' ? null : finalSubject);
      
      // Reset Gemini chat
      chatRef.current = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });
      
      loadSessions();
      return sessionId;
    } catch (error) {
      console.error("Error creating session in Airtable:", error);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const resp = await axios.get(`/api/sessions/${sessionId}/messages`);
      if (!Array.isArray(resp.data)) {
        console.warn("Messages data is not an array:", resp.data);
        return;
      }
      const formattedMessages = resp.data.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp)
      }));
      
      setMessages(formattedMessages);
      setCurrentSessionId(sessionId);
      localStorage.setItem('currentSessionId', sessionId);
      setShowHistory(false);
      setIsSidebarOpen(false);
      setIsStarted(true);

      // Re-initialize Gemini chat with history
      const history = formattedMessages.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      chatRef.current = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
        history: history
      });
    } catch (error) {
      console.error("Error loading messages from Airtable:", error);
    }
  };

  const saveMessageToAirtable = async (message: Message) => {
    if (!currentSessionId) return null;
    try {
      const response = await axios.post('/api/messages', {
        sessionId: currentSessionId,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp.toISOString()
      });
      
      // If there's an attachment, upload it too
      if (message.attachment && selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile.file);
        formData.append('messageId', response.data.id);
        
        await axios.post('/api/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      
      return response.data.id;
    } catch (error) {
      console.error("Error saving message to Airtable:", error);
      return null;
    }
  };

  const performWebSearch = async (query: string) => {
    if (!isSearchEnabled) return null;
    try {
      const response = await axios.post('/api/search', { query });
      return response.data.answer || response.data.results.map((r: any) => r.content).join('\n');
    } catch (error) {
      console.error("Search Error:", error);
      return null;
    }
  };

  useEffect(() => {
    if (!chatRef.current) {
      chatRef.current = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });
    }

    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'fr-FR';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const startSession = async (subjectName?: string) => {
    const sessionId = await createNewSession(subjectName);
    if (sessionId) {
      setIsStarted(true);
      handleInitialGreeting(subjectName);
    }
  };

  const handleInitialGreeting = async (subjectName?: string) => {
    setIsTyping(true);
    const initialPrompt = subjectName 
      ? `Bonjour Coach, je souhaite réviser le sujet : ${subjectName}. Peux-tu me présenter les points clés à maîtriser ?`
      : "Bonjour Coach, je suis prête pour ma session de révision.";
      
    try {
      const response = await chatRef.current.sendMessage({ message: initialPrompt });
      const text = response.text;
      const newMessage: Message = { role: 'model', content: text, timestamp: new Date() };
      setMessages([newMessage]);
      saveMessageToAirtable(newMessage);
      if (isTtsEnabled) generateSpeech(text);
    } catch (error) {
      console.error("Error getting greeting:", error);
    } finally {
      setIsTyping(false);
    }
  };

  const generateSpeech = async (text: string) => {
    if (!isTtsEnabled) return;
    
    try {
      const cleanText = text.replace(/<[^>]*>/g, '');
      
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: `Lis ceci avec une voix de coach professionnel et encourageant : ${cleanText}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Charon' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const url = `data:audio/mp3;base64,${base64Audio}`;
        setAudioUrl(url);
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play().catch(e => {
            console.warn("Autoplay was prevented. User interaction required.", e);
          });
        }
      }
    } catch (error) {
      console.error("TTS Error:", error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      setSelectedFile({ file, base64 });
    };
    reader.readAsDataURL(file);
  };

  const handleSendFromVoice = async (text: string) => {
    if (!text.trim() || isTyping) return;
    
    const userMessage: Message = { role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await chatRef.current.sendMessage({ message: text });
      const responseText = response.text;
      const modelMessage: Message = { role: 'model', content: responseText, timestamp: new Date() };
      setMessages(prev => [...prev, modelMessage]);
      saveMessageToAirtable(userMessage);
      saveMessageToAirtable(modelMessage);

      // AUTOMATIC FILLING: Update session title based on the first real exchange
      if (messages.length <= 2 && currentSessionId) {
        const summaryPrompt = `Fais un titre très court (4-6 mots max) pour cette session de révision basée sur ce premier échange : "${responseText.substring(0, 100)}"`;
        try {
          const summaryResult = await ai.getGenerativeModel({ model: "gemini-3-flash-preview" }).generateContent(summaryPrompt);
          const newTitle = summaryResult.response.text();
          updateSessionTitle(currentSessionId, newTitle.replace(/[#*]/g, '').trim());
        } catch (e) {
          console.error("Title auto-fill error:", e);
        }
      }

      if (isTtsEnabled) generateSpeech(responseText);
    } catch (error) {
      console.error("Chat Error:", error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !selectedFile) || isTyping) return;

    const userMessage: Message = { 
      role: 'user', 
      content: input, 
      timestamp: new Date(),
      attachment: selectedFile ? {
        name: selectedFile.file.name,
        type: selectedFile.file.type,
        data: selectedFile.base64
      } : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    const currentFile = selectedFile;
    
    setInput('');
    setSelectedFile(null);
    setIsTyping(true);

    try {
      // Save User Message to Airtable first to get ID for attachment linking
      await saveMessageToAirtable(userMessage);

      // 1. Check if we need a web search
      let searchContext = "";
      if (isSearchEnabled && (currentInput.toLowerCase().includes('actualité') || currentInput.toLowerCase().includes('récent') || currentInput.toLowerCase().includes('cameroun'))) {
        const searchResults = await performWebSearch(currentInput);
        if (searchResults) {
          searchContext = `\n\n[CONTEXTE D'ACTUALITÉ TAVILY] : ${searchResults}\n\nUtilise ces informations récentes pour enrichir ta réponse.`;
        }
      }

      let response;
      if (currentFile) {
        const parts: any[] = [{ text: (currentInput || "Analyse ce document s'il te plaît.") + searchContext }];
        parts.push({
          inlineData: {
            data: currentFile.base64,
            mimeType: currentFile.file.type
          }
        });
        
        response = await chatRef.current.sendMessage({ message: { parts } });
      } else {
        response = await chatRef.current.sendMessage({ message: currentInput + searchContext });
      }

      const text = response.text;
      const modelMessage: Message = { role: 'model', content: text, timestamp: new Date() };
      
      setMessages(prev => [...prev, modelMessage]);
      saveMessageToAirtable(modelMessage);

      // AUTOMATIC FILLING: Update session title based on the first real exchange
      if (messages.length <= 2 && currentSessionId) {
        const summaryPrompt = `Fais un titre très court (4-6 mots max) pour cette session de révision basée sur ce premier échange : "${text.substring(0, 100)}"`;
        try {
          const summaryResult = await ai.getGenerativeModel({ model: "gemini-3-flash-preview" }).generateContent(summaryPrompt);
          const newTitle = summaryResult.response.text();
          updateSessionTitle(currentSessionId, newTitle.replace(/[#*]/g, '').trim());
        } catch (e) {
          console.error("Title auto-fill error:", e);
        }
      }

      if (isTtsEnabled) generateSpeech(text);
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, { 
        role: 'model', 
        content: "Désolé Christiane, j'ai rencontré une petite difficulté technique lors de l'analyse. Peux-tu réessayer ?", 
        timestamp: new Date() 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start recognition:", e);
      }
    }
  };

  const selectSubject = (subjectName: string) => {
    startSession(subjectName);
  };

  return (
    <div className="flex h-[100dvh] bg-[#f8f9fa] overflow-hidden flex-col lg:flex-row">
      {/* Sidebar - Subjects and History */}
      <aside className={cn(
        "fixed inset-y-0 right-0 z-50 w-full sm:w-[320px] bg-[#0f172a] text-white flex flex-col border-l border-slate-800 transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] lg:relative lg:translate-x-0 order-2 overflow-hidden shadow-2xl lg:shadow-none",
        isSidebarOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="p-5 lg:p-6 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20 overflow-hidden ring-2 ring-white/10">
                <img 
                  src="https://i.postimg.cc/G2LvBGPN/generated_image_(1).png" 
                  alt="Logo" 
                  className="w-full h-full object-cover p-1"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-black tracking-tight text-white leading-none truncate">COACH BARREAU</h1>
                <p className="text-[10px] text-indigo-400 uppercase tracking-[0.2em] font-black mt-1.5 opacity-80">Session 2026</p>
              </div>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 text-slate-400 hover:text-white bg-white/5 rounded-xl transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
          </div>

          <div className="bg-white/5 rounded-[1.25rem] p-3.5 border border-white/5 flex items-center justify-between shadow-inner">
            <div className="min-w-0">
              <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1 opacity-70">Candidate</p>
              <p className="text-sm font-bold text-white truncate pr-2">Christiane Endalle</p>
            </div>
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                "p-2.5 rounded-xl transition-all duration-300",
                showHistory ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 rotate-12" : "bg-white/10 text-slate-300 hover:bg-white/20 active:scale-95"
              )}
              title="Historique de révision"
            >
              <History size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 lg:px-6 py-6 space-y-8 custom-scrollbar">
          {showHistory ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center justify-between sticky top-0 bg-[#0f172a]/95 backdrop-blur-md py-1 z-10 -mx-1 px-1">
                <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  <History size={13} className="text-indigo-400" /> Archives par Discipline
                </h2>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => setIsSearchEnabled(!isSearchEnabled)}
                    className={cn(
                      "text-[9px] font-black p-1.5 rounded-lg transition-all border transition-all duration-300",
                      isSearchEnabled ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20" : "bg-white/5 border-white/5 text-slate-600 opacity-50"
                    )}
                    title={isSearchEnabled ? "Recherche Web Active" : "Recherche Web Désactivée"}
                  >
                    <Globe size={13} />
                  </button>
                </div>
              </div>
              
              <div className="space-y-6">
                {sessions.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-[2rem] bg-white/[0.01]">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 opacity-20">
                      <History size={24} />
                    </div>
                    <p className="text-[11px] text-slate-600 italic font-bold uppercase tracking-wider px-4">Aucun enregistrement</p>
                  </div>
                ) : (
                  Object.entries(
                    sessions.reduce((acc, session) => {
                      const subject = session.subject || "Non catégorisé";
                      if (!acc[subject]) acc[subject] = [];
                      acc[subject].push(session);
                      return acc;
                    }, {} as Record<string, ChatSession[]>)
                  ).map(([subject, sessionList]) => (
                    <div key={subject} className="space-y-3">
                      <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.25em] pl-1 opacity-80 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                        {subject}
                      </h3>
                      <div className="space-y-2.5">
                        {sessionList.map((session) => (
                          <button
                            key={session.id}
                            onClick={() => loadSession(session.id)}
                            className={cn(
                              "w-full p-4 rounded-[1.25rem] transition-all duration-300 text-left border relative group ring-offset-[#0f172a]",
                              currentSessionId === session.id 
                                ? "bg-indigo-600 border-indigo-500 shadow-[0_10px_25px_-5px_rgba(79,70,229,0.4)]" 
                                : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10 active:scale-[0.98]"
                            )}
                          >
                            <div className="flex justify-between items-start mb-1.5 gap-2">
                              <p className={cn(
                                "text-xs font-bold line-clamp-1 flex-1 leading-tight",
                                currentSessionId === session.id ? "text-white" : "text-slate-200"
                              )}>
                                {session.title || "Session d'étude"}
                              </p>
                              <span className={cn(
                                "text-[9px] font-black opacity-40 whitespace-nowrap",
                                currentSessionId === session.id ? "text-indigo-100" : "text-slate-500"
                              )}>
                                {new Date(session.lastUpdated).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                              </span>
                            </div>
                            <div className={cn(
                              "text-[10px] font-medium opacity-60 line-clamp-1",
                              currentSessionId === session.id ? "text-indigo-200" : "text-slate-500"
                            )}>
                              {session.subject || "Mise à niveau"}
                            </div>
                            
                            {currentSessionId === session.id && (
                              <div className="absolute right-3 bottom-3 w-1.5 h-1.5 bg-white rounded-full animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <>
              <section className="space-y-4">
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 pl-1">
                  <BookOpen size={12} className="text-indigo-400" /> Domaines d'Examen
                </h2>
                <div className="grid grid-cols-1 gap-2">
                  {SUBJECTS.map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => selectSubject(sub.name)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3.5 rounded-[1.25rem] transition-all duration-300 text-left border group relative overflow-hidden",
                        activeSubject === sub.name 
                          ? "bg-indigo-600 border-indigo-500 shadow-xl shadow-indigo-600/20" 
                          : "bg-white/[0.03] border-white/5 hover:bg-white/[0.07] hover:border-white/10 active:scale-[0.98]"
                      )}
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm",
                        activeSubject === sub.name ? "bg-white/20 text-white" : cn("bg-[#0f172a]", sub.color)
                      )}>
                        <sub.icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={cn(
                          "text-xs font-bold leading-tight block truncate",
                          activeSubject === sub.name ? "text-white" : "text-slate-300 group-hover:text-white"
                        )}>
                          {sub.name}
                        </span>
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-wider opacity-40",
                          activeSubject === sub.name ? "text-indigo-100" : "text-slate-500"
                        )}>
                          Matière Requise
                        </span>
                      </div>
                      {activeSubject === sub.name && (
                        <div className="absolute right-0 top-0 bottom-0 w-1 bg-white animate-pulse" />
                      )}
                    </button>
                  ))}
                </div>
              </section>

              <section className="bg-indigo-600/5 rounded-2xl p-4 border border-indigo-500/10">
                <h3 className="text-xs font-bold text-indigo-400 mb-2 flex items-center gap-2">
                  <ShieldAlert size={14} /> Rappel
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Maîtrise des textes camerounais et OHADA indispensable.
                </p>
              </section>
            </>
          )}
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Session Sauvegardée
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setIsTtsEnabled(!isTtsEnabled)}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all border font-bold text-xs uppercase tracking-wider",
                isTtsEnabled 
                  ? "bg-indigo-600/10 border-indigo-600/20 text-indigo-400" 
                  : "bg-slate-800 border-slate-700 text-slate-500"
              )}
            >
              {isTtsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              {isTtsEnabled ? "Voix Active" : "Voix Muette"}
            </button>
            <button 
              onClick={() => createNewSession()}
              className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Nouvelle session"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Block - Chatbot and Discussion */}
      <div className="flex-1 flex flex-col bg-white order-1 relative overflow-hidden">
          {/* Mobile Header AREA */}
          <header className="lg:hidden h-16 bg-white border-b border-slate-100/80 flex items-center justify-between px-5 sticky top-0 z-40 backdrop-blur-xl shadow-sm shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 overflow-hidden ring-2 ring-indigo-50/50">
                <img 
                  src="https://i.postimg.cc/G2LvBGPN/generated_image_(1).png" 
                  alt="Logo" 
                  className="w-full h-full object-cover p-1"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="min-w-0">
                <h2 className="font-black text-slate-900 text-sm tracking-tight leading-none">COACH BARREAU</h2>
                <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider mt-1 opacity-70">Christiane E.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setIsSidebarOpen(true);
                  setShowHistory(true);
                }}
                className="p-2.5 text-indigo-600 bg-indigo-50 rounded-xl active:scale-95 transition-all shadow-sm border border-indigo-100"
                title="Historique"
              >
                <History size={18} />
              </button>
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2.5 text-slate-600 bg-slate-50 border border-slate-100 rounded-xl active:scale-95 transition-all"
              >
                <Menu size={20} />
              </button>
            </div>
          </header>

          <main className="flex-1 flex flex-col min-h-0 bg-[#fdfdff] relative overflow-hidden">
            {!isStarted && (
              <div className="absolute inset-0 z-50 bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
                <div className="relative mb-10">
                  <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full translate-y-4" />
                  <div className="relative w-24 h-24 bg-white rounded-[2.25rem] flex items-center justify-center shadow-2xl shadow-indigo-600/20 overflow-hidden border-2 border-indigo-50 ring-8 ring-indigo-50/30 animate-bounce">
                    <img 
                      src="https://i.postimg.cc/G2LvBGPN/generated_image_(1).png" 
                      alt="Logo" 
                      className="w-16 h-16 object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
                
                <h2 className="text-3xl lg:text-4xl font-black text-slate-900 mb-4 tracking-tighter leading-tight max-w-sm">
                  Coach Barreau <span className="text-indigo-600 underline decoration-indigo-600/30 underline-offset-8">2026</span>
                </h2>
                
                <p className="text-slate-500 text-sm lg:text-base max-w-sm mb-12 leading-relaxed font-medium px-4">
                  Prête à réussir Christiane ? Je suis là pour t'accompagner avec rigueur jusqu'à ton admission au Barreau.
                </p>
                
                <div className="flex flex-col w-full max-w-xs gap-3">
                  <button 
                    onClick={() => startSession()}
                    className="group bg-indigo-600 text-white py-5 px-8 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-600/30 active:scale-[0.97] flex items-center justify-center gap-3"
                  >
                    Lancer la Révision
                    <ChevronLeft className="rotate-180 transition-transform group-hover:translate-x-1" size={20} />
                  </button>
                  
                  <div className="mt-6 flex items-center justify-center gap-1.5">
                    <History size={12} className="text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sessions Illimitées</span>
                  </div>
                </div>
              </div>
            )}

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-3 lg:p-10 space-y-4 lg:space-y-10 scroll-smooth bg-slate-50/30"
        >
          {messages.map((msg, i) => (
            <div 
              key={i} 
              className={cn(
                "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "flex gap-2 lg:gap-4 max-w-[95%] lg:max-w-[85%]",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}>
                <div className={cn(
                  "w-7 h-7 lg:w-10 lg:h-10 rounded-xl flex-shrink-0 flex items-center justify-center shadow-md mt-1 overflow-hidden shrink-0 border border-white/10",
                  msg.role === 'user' ? "bg-slate-100 ring-4 ring-slate-100/50" : "bg-white ring-4 ring-indigo-50"
                )}>
                  {msg.role === 'user' ? (
                    <img 
                      src="https://i.postimg.cc/cJQfnr2V/Whats-App-Image-2025-09-10-at-11-07-09-(1).jpg" 
                      alt="Christiane" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <img 
                      src="https://i.postimg.cc/G2LvBGPN/generated_image_(1).png" 
                      alt="Coach" 
                      className="w-full h-full object-cover p-1"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
                
                <div className={cn(
                  "flex flex-col gap-1.5 min-w-0",
                  msg.role === 'user' ? "items-end text-right" : "items-start text-left"
                )}>
                  {msg.attachment && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-[1rem] text-[10px] font-black uppercase tracking-wider shadow-lg shadow-indigo-200 border border-white/20">
                      <FileText size={12} />
                      <span className="truncate max-w-[120px] sm:max-w-none">{msg.attachment.name}</span>
                    </div>
                  )}
                  <div className={cn(
                    "p-4 lg:p-5 rounded-[1.5rem] shadow-sm border leading-relaxed",
                    msg.role === 'user' 
                      ? "bg-white border-slate-200 text-slate-800 rounded-tr-none shadow-indigo-500/5" 
                      : "bg-indigo-50/50 border-indigo-100 text-slate-900 rounded-tl-none"
                  )}>
                    <div className="markdown-body prose prose-slate max-w-none prose-p:leading-relaxed prose-strong:text-indigo-900 prose-strong:font-black prose-p:my-1 prose-ul:my-2 prose-li:my-1 text-sm lg:text-[15px]">
                      <Markdown>
                        {msg.content}
                      </Markdown>
                    </div>
                    <div className={cn(
                      "flex items-center gap-2 mt-4 pt-3 border-t",
                      msg.role === 'user' ? "justify-end border-slate-100" : "justify-start border-indigo-100/40"
                    )}>
                      <span className="text-[9px] font-black uppercase tracking-[0.1em] opacity-30 select-none">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {msg.role === 'model' && (
                         <button onClick={() => generateSpeech(msg.content)} className="p-1 hover:text-indigo-600 transition-colors opacity-30 hover:opacity-100">
                           <Volume2 size={12} />
                         </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start animate-in fade-in duration-300">
              <div className="flex gap-4 lg:gap-6">
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 overflow-hidden">
                  <img 
                    src="https://i.postimg.cc/G2LvBGPN/generated_image_(1).png" 
                    alt="Logo" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="bg-indigo-50/50 border border-indigo-100 p-3 lg:p-5 rounded-2xl rounded-tl-none flex items-center gap-2">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-3 lg:p-6 bg-white border-t border-slate-100 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">
          {selectedFile && (
            <div className="mb-3 p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 lg:gap-3">
                <div className="p-1.5 bg-white rounded-lg text-indigo-600 shadow-sm">
                  <File size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate max-w-[120px] sm:max-w-[250px]">{selectedFile.file.name}</p>
                  <p className="text-[9px] text-indigo-500 uppercase font-bold tracking-wider">Document prêt</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedFile(null)}
                className="p-1 text-slate-400 hover:text-red-500 transition-colors bg-white rounded-lg shadow-sm border border-slate-100"
              >
                <X size={14} />
              </button>
            </div>
          )}
          
          <form onSubmit={handleSend} className="relative flex items-center gap-2 lg:gap-3">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 lg:p-3.5 rounded-xl bg-slate-50 text-slate-400 border border-slate-200 hover:text-indigo-600 hover:border-indigo-200 transition-all hover:bg-white hover:shadow-sm"
              title="Ajouter un document"
            >
              <Paperclip size={20} />
            </button>
            <button
              type="button"
              onClick={toggleListening}
              className={cn(
                "p-2.5 lg:p-3.5 rounded-xl transition-all duration-300 border",
                isListening 
                  ? "bg-red-50 border-red-200 text-red-500 animate-pulse" 
                  : "bg-slate-50 border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200"
              )}
              title={isListening ? "Arrêter l'écoute" : "Parler"}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "Le Coach vous écoute..." : "Répondez..."}
              className={cn(
                "flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 lg:px-6 py-2.5 lg:py-3.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm lg:text-base",
                isListening && "placeholder:text-red-400"
              )}
            />
            <button
              id="send-button"
              type="submit"
              disabled={(!input.trim() && !selectedFile) || isTyping}
              className="bg-indigo-600 text-white p-2.5 lg:p-3.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-200"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </main>
    </div>

    {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Hidden Audio Element */}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
