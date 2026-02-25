import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Send, Scale, Volume2, VolumeX, Loader2, BookOpen, Gavel, 
  ShieldAlert, Users, FileText, Building2, RefreshCw, Mic, MicOff, Paperclip, X, File 
} from 'lucide-react';
import Markdown from 'react-markdown';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const SUBJECTS = [
  { id: 'famille', name: 'Droit patrimonial de la famille', icon: Users, color: 'text-blue-600' },
  { id: 'procedure', name: 'Procédure civile', icon: Scale, color: 'text-indigo-600' },
  { id: 'penal', name: 'Droit pénal', icon: ShieldAlert, color: 'text-red-600' },
  { id: 'execution', name: "Voies d'exécution", icon: Gavel, color: 'text-amber-600' },
  { id: 'social', name: 'Droit social', icon: FileText, color: 'text-emerald-600' },
  { id: 'administratif', name: 'Droit administratif', icon: Building2, color: 'text-purple-600' },
];

const SYSTEM_INSTRUCTION = `Tu es le "Coach Barreau 2026", expert en droit camerounais pour Christiane Endalle.
RÈGLES : ❶ Gras pour mots-clés. ❷ PAS de balise <b>. ❸ Puces circulaires (❶, ❷). ❹ Phrases courtes. ❺ Saute deux lignes entre paragraphes.`;

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);
  const [isStarted, setIsStarted] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeSubject, setActiveSubject] = useState(null);
  
  const scrollRef = useRef(null);
  const chatRef = useRef(null);

  // Initialisation sécurisée de l'IA
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  const ai = new GoogleGenAI(apiKey);

  useEffect(() => {
    if (!chatRef.current && apiKey) {
      chatRef.current = ai.getGenerativeModel({ model: "gemini-1.5-flash" }).startChat({
        history: [],
        generationConfig: { maxOutputTokens: 2000 },
      });
    }
  }, [apiKey]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const startSession = async () => {
    setIsStarted(true);
    setIsTyping(true);
    try {
      const result = await chatRef.current.sendMessage("Bonjour Coach, je suis Christiane. Je suis prête.");
      const response = await result.response;
      setMessages([{ role: 'model', content: response.text(), timestamp: new Date() }]);
    } catch (e) { console.error(e); }
    setIsTyping(false);
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = { role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const result = await chatRef.current.sendMessage(input);
      const response = await result.response;
      setMessages(prev => [...prev, { role: 'model', content: response.text(), timestamp: new Date() }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', content: "Erreur de connexion. Vérifie ta clé API.", timestamp: new Date() }]);
    }
    setIsTyping(false);
  };

  return (
    <div className="flex h-screen bg-[#f8f9fa] font-sans">
      {/* Sidebar - Design AI Studio */}
      <aside className="w-[350px] bg-[#0f172a] text-white flex flex-col order-2 border-l border-slate-800">
        <div className="p-6 border-b border-slate-800">
            <h1 className="text-xl font-bold text-indigo-400">COACH BARREAU</h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Session 2026 | Christiane</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {SUBJECTS.map((sub) => (
            <button key={sub.id} onClick={() => {setInput(`Révisons : ${sub.name}`); setActiveSubject(sub.name)}} 
              className={cn("w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left text-xs font-semibold border", 
              activeSubject === sub.name ? "bg-indigo-600 border-indigo-500" : "bg-slate-800/40 border-slate-700 hover:bg-slate-800")}>
              <sub.icon size={16} className={sub.color} /> {sub.name}
            </button>
          ))}
        </div>
        <div className="p-6 bg-slate-900/50">
            <button onClick={() => window.location.reload()} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all font-bold text-xs uppercase">
                <RefreshCw size={14} /> Nouvelle Session
            </button>
        </div>
      </aside>

      {/* Main Chat */}
      <main className="flex-1 flex flex-col bg-white order-1 relative">
        {!isStarted && (
          <div className="absolute inset-0 z-50 bg-white flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl mb-6 animate-bounce">
              <Scale className="text-white w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Prête pour vos révisions, Christiane ?</h2>
            <button onClick={startSession} className="mt-6 bg-indigo-600 text-white px-10 py-4 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all">
              Commencer la session
            </button>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] p-4 rounded-2xl shadow-sm border", 
                msg.role === 'user' ? "bg-white border-slate-200" : "bg-indigo-50 border-indigo-100")}>
                <div className="prose prose-slate text-sm leading-relaxed">
                  <Markdown>{msg.content}</Markdown>
                </div>
              </div>
            </div>
          ))}
          {isTyping && <div className="text-indigo-500 font-bold animate-pulse text-xs">Le Coach réfléchit...</div>}
        </div>

        <form onSubmit={handleSend} className="p-6 border-t flex gap-3">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} 
            placeholder="Posez votre question de droit..." 
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button type="submit" className="bg-indigo-600 text-white p-3 rounded-xl shadow-md hover:bg-indigo-700">
            <Send size={20} />
          </button>
        </form>
      </main>
    </div>
  );
}