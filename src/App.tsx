import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
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
  ChevronLeft
} from 'lucide-react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Constants & Types ---

const SUBJECTS = [
  { id: 'famille', name: 'Droit patrimonial de la famille', icon: Users, color: 'text-blue-600' },
  { id: 'procedure', name: 'Procédure civile', icon: Scale, color: 'text-indigo-600' },
  { id: 'penal', name: 'Droit pénal', icon: ShieldAlert, color: 'text-red-600' },
  { id: 'execution', name: "Voies d'exécution", icon: Gavel, color: 'text-amber-600' },
  { id: 'social', name: 'Droit social', icon: FileText, color: 'text-emerald-600' },
  { id: 'administratif', name: 'Droit administratif', icon: Building2, color: 'text-purple-600' },
  { id: 'methodologie', name: 'Méthodologie juridique', icon: FileText, color: 'text-cyan-600' },
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

  const loadSessions = () => {
    const q = query(
      collection(db, 'sessions'),
      orderBy('lastUpdated', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const loadedSessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatSession[];
      setSessions(loadedSessions);
      
      // If we have a saved session ID, load its messages if not already loaded
      const savedSessionId = localStorage.getItem('currentSessionId');
      if (savedSessionId && messages.length === 0) {
        const session = loadedSessions.find(s => s.id === savedSessionId);
        if (session) {
          loadSession(savedSessionId, loadedSessions);
        }
      }
    });
  };

  const createNewSession = async () => {
    const newSession = {
      userId: 'public',
      messages: [],
      lastUpdated: serverTimestamp(),
      createdAt: serverTimestamp()
    };

    try {
      const docRef = await addDoc(collection(db, 'sessions'), newSession);
      const sessionId = docRef.id;
      setCurrentSessionId(sessionId);
      localStorage.setItem('currentSessionId', sessionId);
      setMessages([]);
      setActiveSubject(null);
      setIsSidebarOpen(false);
      
      // Reset Gemini chat
      chatRef.current = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });
      
      return sessionId;
    } catch (error) {
      console.error("Error creating session:", error);
    }
  };

  const loadSession = async (sessionId: string, sessionList?: ChatSession[]) => {
    const list = sessionList || sessions;
    const session = list.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      localStorage.setItem('currentSessionId', sessionId);
      
      // Convert Firestore timestamps to Dates for the UI
      const formattedMessages = session.messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp instanceof Timestamp ? msg.timestamp.toDate() : new Date(msg.timestamp)
      }));
      setMessages(formattedMessages);
      setActiveSubject(session.subject || null);
      setShowHistory(false);
      setIsSidebarOpen(false);
      setIsStarted(true);

      // Re-initialize Gemini chat with history
      const history = formattedMessages.map(msg => ({
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
    }
  };

  const saveMessageToFirestore = async (newMessages: Message[]) => {
    if (!currentSessionId) return;

    try {
      // Strip base64 data before saving to Firestore to avoid size limits and freezes
      const messagesToSave = newMessages.map(msg => {
        if (msg.attachment && msg.attachment.data) {
          const { data, ...rest } = msg.attachment;
          return { ...msg, attachment: rest };
        }
        return msg;
      });

      const sessionRef = doc(db, 'sessions', currentSessionId);
      await updateDoc(sessionRef, {
        messages: messagesToSave,
        lastUpdated: serverTimestamp(),
        subject: activeSubject || undefined
      });
    } catch (error) {
      console.error("Error saving message:", error);
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

  const startSession = async () => {
    const sessionId = await createNewSession();
    if (sessionId) {
      setIsStarted(true);
      handleInitialGreeting();
    }
  };

  const handleInitialGreeting = async () => {
    setIsTyping(true);
    try {
      const response = await chatRef.current.sendMessage({ message: "Bonjour Coach, je suis prête pour ma session de révision." });
      const text = response.text;
      const newMessage: Message = { role: 'model', content: text, timestamp: new Date() };
      const updatedMessages = [newMessage];
      setMessages(updatedMessages);
      saveMessageToFirestore(updatedMessages);
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
        model: "gemini-2.5-flash-preview-tts",
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
      const updatedMessages = [...messages, userMessage, modelMessage];
      setMessages(prev => [...prev, modelMessage]);
      saveMessageToFirestore(updatedMessages);
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

    // Strip base64 data from the user message before updating state to avoid browser memory issues
    const userMessageForState = { ...userMessage };
    if (userMessageForState.attachment) {
      const { data, ...rest } = userMessageForState.attachment;
      userMessageForState.attachment = rest;
    }

    setMessages(prev => [...prev, userMessageForState]);
    const currentInput = input;
    const currentFile = selectedFile;
    
    setInput('');
    setSelectedFile(null);
    setIsTyping(true);

    try {
      let response;
      if (currentFile) {
        const parts: any[] = [{ text: currentInput || "Analyse ce document s'il te plaît." }];
        parts.push({
          inlineData: {
            data: currentFile.base64,
            mimeType: currentFile.file.type
          }
        });
        
        response = await chatRef.current.sendMessage({ message: { parts } });
      } else {
        response = await chatRef.current.sendMessage({ message: currentInput });
      }

      const text = response.text;
      const modelMessage: Message = { role: 'model', content: text, timestamp: new Date() };
      
      setMessages(prev => [...prev, modelMessage]);
      
      const updatedMessages = [...messages, userMessageForState, modelMessage];
      saveMessageToFirestore(updatedMessages);
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
    setActiveSubject(subjectName);
    setInput(`Je souhaite réviser le sujet suivant : ${subjectName}`);
    setIsSidebarOpen(false);
    setTimeout(() => {
      const btn = document.getElementById('send-button');
      btn?.click();
    }, 100);
  };

  return (
    <div className="flex h-[100dvh] bg-[#f8f9fa] overflow-hidden flex-col lg:flex-row">
      {/* Sidebar - Subjects and Info */}
      <aside className={cn(
        "fixed inset-y-0 right-0 z-50 w-full sm:w-[320px] bg-slate-900 text-white flex flex-col border-l border-slate-800 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 order-2",
        isSidebarOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="p-4 lg:p-6 border-b border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 overflow-hidden">
                <img 
                  src="https://i.postimg.cc/G2LvBGPN/generated_image_(1).png" 
                  alt="Logo" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Coach Barreau</h1>
                <p className="text-[9px] text-indigo-400 uppercase tracking-[0.2em] font-bold">Session 2026</p>
              </div>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 text-slate-400 hover:text-white"
            >
              <ChevronLeft size={20} />
            </button>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Candidate</p>
              <p className="text-sm font-semibold text-white">Christiane Endalle</p>
            </div>
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                "p-2 rounded-lg transition-all",
                showHistory ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              )}
              title="Historique"
            >
              <History size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {showHistory ? (
            <section className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <History size={12} className="text-indigo-500" /> Historique
                </h2>
                <button 
                  onClick={createNewSession}
                  className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 uppercase tracking-wider bg-indigo-500/10 px-2 py-1 rounded-md"
                >
                  <PlusCircle size={12} /> Nouvelle
                </button>
              </div>
              <div className="space-y-2.5">
                {sessions.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-slate-800 rounded-2xl">
                    <p className="text-xs text-slate-500 italic">Aucune session enregistrée</p>
                  </div>
                ) : (
                  sessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => loadSession(session.id)}
                      className={cn(
                        "w-full p-3.5 rounded-2xl transition-all text-left border group relative",
                        currentSessionId === session.id 
                          ? "bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-500/20 ring-2 ring-indigo-500/20" 
                          : "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600"
                      )}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-wider truncate max-w-[120px]",
                          currentSessionId === session.id ? "text-indigo-100" : "text-slate-400"
                        )}>
                          {session.subject || "Session générale"}
                        </span>
                        <span className={cn(
                          "text-[9px] font-medium",
                          currentSessionId === session.id ? "text-indigo-300" : "text-slate-600"
                        )}>
                          {session.lastUpdated instanceof Timestamp 
                            ? session.lastUpdated.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) 
                            : new Date(session.lastUpdated).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <p className={cn(
                        "text-xs line-clamp-2 leading-relaxed font-medium",
                        currentSessionId === session.id ? "text-white" : "text-slate-400"
                      )}>
                        {session.messages[session.messages.length - 1]?.content || "Nouvelle session"}
                      </p>
                      {currentSessionId === session.id && (
                        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-full shadow-sm" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </section>
          ) : (
            <>
              <section>
                <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <BookOpen size={12} className="text-indigo-500" /> Matières à réviser
                </h2>
                <div className="space-y-2">
                  {SUBJECTS.map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => selectSubject(sub.name)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left border group",
                        activeSubject === sub.name 
                          ? "bg-indigo-600 border-indigo-500 shadow-md shadow-indigo-500/10" 
                          : "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600"
                      )}
                    >
                      <div className={cn(
                        "p-2 rounded-lg transition-colors",
                        activeSubject === sub.name ? "bg-white/20 text-white" : cn("bg-slate-900", sub.color)
                      )}>
                        <sub.icon size={16} />
                      </div>
                      <span className={cn(
                        "text-xs font-semibold leading-tight",
                        activeSubject === sub.name ? "text-white" : "text-slate-300 group-hover:text-white"
                      )}>
                        {sub.name}
                      </span>
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
              onClick={createNewSession}
              className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Nouvelle session"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Block - Chatbot and Discussion */}
      <main className="flex-1 flex flex-col bg-white order-1 relative overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white z-30 sticky top-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm overflow-hidden">
                <img 
                  src="https://i.postimg.cc/G2LvBGPN/generated_image_(1).png" 
                  alt="Logo" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="font-bold text-slate-900 text-sm tracking-tight">Coach Barreau</span>
            </div>
          </div>
          <button 
            onClick={createNewSession}
            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1"
            title="Nouvelle Session"
          >
            <Plus size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Nouveau</span>
          </button>
        </header>

        {!isStarted && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/20 mb-6 animate-bounce overflow-hidden border border-slate-100">
              <img 
                src="https://i.postimg.cc/G2LvBGPN/generated_image_(1).png" 
                alt="Logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              Bienvenue Christiane
            </h2>
            <p className="text-sm text-slate-500 max-w-sm mb-8 leading-relaxed">
              Je suis votre Coach personnel pour le Barreau 2026. Cliquez ci-dessous pour commencer notre session.
            </p>
            <button 
              onClick={startSession}
              className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-base hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 flex items-center gap-2"
            >
              Commencer la session
            </button>
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
                "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-400",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "flex gap-2 lg:gap-4 max-w-[92%] lg:max-w-[85%]",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}>
                <div className={cn(
                  "w-7 h-7 lg:w-10 lg:h-10 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm mt-0.5 overflow-hidden border border-slate-200",
                  msg.role === 'user' ? "bg-slate-100" : "bg-white shadow-lg shadow-indigo-500/10"
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
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
                
                <div className={cn(
                  "flex flex-col gap-2",
                  msg.role === 'user' ? "items-end" : "items-start"
                )}>
                  {msg.attachment && (
                    <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-xs font-bold shadow-sm">
                      <File size={14} className="text-indigo-600" />
                      <span>{msg.attachment.name}</span>
                    </div>
                  )}
                  <div className={cn(
                    "p-3 lg:p-4 rounded-2xl shadow-sm border leading-relaxed text-sm lg:text-base",
                    msg.role === 'user' 
                      ? "bg-white border-slate-200 text-slate-800 rounded-tr-none" 
                      : "bg-indigo-50/50 border-indigo-100 text-slate-900 rounded-tl-none"
                  )}>
                    <div className="markdown-body prose prose-slate max-w-none prose-p:leading-relaxed prose-strong:text-indigo-900 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 text-sm lg:text-base">
                      <Markdown>
                        {msg.content}
                      </Markdown>
                    </div>
                    <div className={cn(
                      "text-[9px] lg:text-[10px] mt-3 font-bold opacity-30 uppercase tracking-[0.15em]",
                      msg.role === 'user' ? "text-right" : "text-left"
                    )}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
