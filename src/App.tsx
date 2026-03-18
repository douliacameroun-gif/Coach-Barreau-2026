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
  Menu,
  Trash2,
  Download
} from 'lucide-react';
import Markdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
];

const SYSTEM_INSTRUCTION = `Tu es le "Coach Barreau 2026", un assistant juridique expert en droit camerounais, dévoué à la préparation de Christiane Endalle pour l'examen du barreau de la session 2026.

RÈGLES DE FORMATAGE "VOICE-READY" ET "CLEAN-DISPLAY" (STRICTES) :
❶ Formatage Gras : Mets les titres et les mots clés en gras en utilisant le formatage Markdown standard (double astérisque).
❷ INTERDICTION : Il est formellement interdit d'utiliser la balise HTML <b>.
❸ Zéro Caractère Spécial : N'utilise pas de guillemets ("), de tirets de liste (-), ou d'accolades ({}). Seuls les doubles astérisques pour le gras sont autorisés.
❹ Structure de Liste : Pour lister des choix, des étapes ou des questions, utilise uniquement des puces numériques circulaires (❶, ❷, ❸, ❹, ❺, ❻, etc.).
❺ Style de Ponctuation : Utilise uniquement le point, la virgule, le point d'interrogation et le point d'exclamation pour une synthèse vocale fluide.
❻ Simplicité Vocale : Fais des paragraphes très courts et aérés. Chaque phrase doit être simple, directe et courte. Saute des lignes entre chaque idée.

RÈGLE DE SYNTHÈSE PDF (CRITIQUE) :
À la fin de chaque résolution de cas pratique, de question juridique ou de problème complexe, tu DOIS proposer une synthèse structurée.
Cette synthèse doit être incluse à la fin de ton message, délimitée par les balises [SYNTHESE] et [/SYNTHESE].
Le contenu entre ces balises doit être structuré ainsi :
- TITRE : [Titre du sujet]
- RAPPEL DES FAITS : [Bref résumé]
- PROBLÈME JURIDIQUE : [La question de droit]
- SOLUTION : [La réponse détaillée]
- ARTICLES DE LOI : [Liste des articles cités]
- CONSEIL DU COACH : [Un conseil pour l'examen]

Mission :
❶ Évaluation : Pose des questions de cours ou des mini-cas pratiques sur les 6 matières exigées.
❷ Correction : Attends la réponse de Christiane avant de donner la solution. Cite les articles de loi camerounais.
❸ Analyse : Analyse les documents téléchargés en respectant ces règles.
❹ Langue : Français exclusivement.

Commence par saluer Christiane chaleureusement et invite-la à choisir une matière dans le panneau latéral.`;

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
  attachment?: {
    name: string;
    type: string;
    data?: string;
  };
  synthesis?: string;
}

interface Session {
  id: string;
  subject: string;
  title: string;
  messages: Message[];
  timestamp: Date;
}

// --- Components ---

export default function App() {
  const [sessions, setSessions] = useState<Session[]>(() => {
    const saved = localStorage.getItem('coach_barreau_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((s: any) => ({
          ...s,
          timestamp: new Date(s.timestamp),
          messages: s.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }))
        }));
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ file: File; base64: string } | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived state
  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession?.messages || [];

  // Initialize Gemini
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  const chatRef = useRef<any>(null);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('coach_barreau_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Load chat session when activeSessionId changes
  useEffect(() => {
    if (activeSessionId) {
      const session = sessions.find(s => s.id === activeSessionId);
      if (session) {
        chatRef.current = ai.chats.create({
          model: "gemini-3-flash-preview",
          config: {
            systemInstruction: `${SYSTEM_INSTRUCTION}\n\nLe sujet actuel de révision est : ${session.subject}. Concentre-toi sur cette matière.`,
          },
          history: session.messages.map(m => ({
            role: m.role,
            parts: [{ text: m.content }]
          }))
        });
      }
    }
  }, [activeSessionId]);

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
        setInput(transcript);
        setIsListening(false);
        setTimeout(() => {
          handleSendFromVoice(transcript);
        }, 500);
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

  const startSession = () => {
    setIsStarted(true);
    handleInitialGreeting();
  };

  const handleInitialGreeting = async () => {
    if (messages.length > 0) return;
    setIsTyping(true);
    try {
      const response = await chatRef.current.sendMessage({ message: "Bonjour Coach, je suis prête pour ma session de révision." });
      const text = response.text;
      
      const { cleanContent, synthesis } = extractSynthesis(text);
      const newMessage: Message = { 
        role: 'model', 
        content: cleanContent, 
        timestamp: new Date(),
        synthesis: synthesis || undefined
      };
      
      updateActiveSession([newMessage]);
      
      if (isTtsEnabled) generateSpeech(cleanContent);
    } catch (error) {
      console.error("Error getting greeting:", error);
    } finally {
      setIsTyping(false);
    }
  };

  const extractSynthesis = (text: string) => {
    const regex = /\[SYNTHESE\]([\s\S]*?)\[\/SYNTHESE\]/;
    const match = text.match(regex);
    if (match) {
      const synthesis = match[1].trim();
      const cleanContent = text.replace(regex, '').trim();
      return { cleanContent, synthesis };
    }
    return { cleanContent: text, synthesis: null };
  };

  const generatePDF = (synthesisText: string) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(79, 70, 229); // Indigo-600
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('COACH BARREAU 2026', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('SYNTHÈSE DE RÉVISION - SESSION DE CHRISTIANE ENDALLE', 105, 30, { align: 'center' });

    // Content parsing
    const lines = synthesisText.split('\n');
    let currentY = 55;
    
    doc.setTextColor(30, 41, 59); // Slate-800
    
    const sections: { title: string, content: string }[] = [];
    let currentSection: { title: string, content: string } | null = null;

    lines.forEach(line => {
      if (line.includes(':')) {
        const [title, ...rest] = line.split(':');
        if (currentSection) sections.push(currentSection);
        currentSection = { title: title.trim(), content: rest.join(':').trim() };
      } else if (currentSection && line.trim()) {
        currentSection.content += ' ' + line.trim();
      }
    });
    if (currentSection) sections.push(currentSection);

    sections.forEach(section => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(79, 70, 229);
      doc.text(section.title, 20, currentY);
      currentY += 7;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      
      const splitText = doc.splitTextToSize(section.content, 170);
      doc.text(splitText, 20, currentY);
      currentY += (splitText.length * 5) + 10;

      if (currentY > 270) {
        doc.addPage();
        currentY = 20;
      }
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Généré par Coach Barreau 2026 - Page ${i} sur ${pageCount}`, 105, 285, { align: 'center' });
    }

    doc.save(`Synthese_Coach_Barreau_${new Date().getTime()}.pdf`);
  };

  const updateActiveSession = (newMessages: Message[]) => {
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s => 
      s.id === activeSessionId 
        ? { ...s, messages: newMessages, timestamp: new Date() } 
        : s
    ));
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
    if (!text.trim() || isTyping || !activeSessionId) return;
    
    const userMessage: Message = { role: 'user', content: text, timestamp: new Date() };
    const updatedMessages = [...messages, userMessage];
    updateActiveSession(updatedMessages);
    
    setInput('');
    setIsTyping(true);

    try {
      const response = await chatRef.current.sendMessage({ message: text });
      const responseText = response.text;
      
      const { cleanContent, synthesis } = extractSynthesis(responseText);
      const modelMessage: Message = { 
        role: 'model', 
        content: cleanContent, 
        timestamp: new Date(),
        synthesis: synthesis || undefined
      };
      
      const finalMessages = [...updatedMessages, modelMessage];
      updateActiveSession(finalMessages);
      
      if (isTtsEnabled) generateSpeech(cleanContent);
    } catch (error) {
      console.error("Chat Error:", error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (((!input.trim() && !selectedFile) || isTyping) || !activeSessionId) return;

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

    const updatedWithUser = [...messages, userMessage];
    updateActiveSession(updatedWithUser);

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
      const { cleanContent, synthesis } = extractSynthesis(text);
      const modelMessage: Message = { 
        role: 'model', 
        content: cleanContent, 
        timestamp: new Date(),
        synthesis: synthesis || undefined
      };
      
      const finalMessages = [...updatedWithUser, modelMessage];
      updateActiveSession(finalMessages);
      
      if (isTtsEnabled) generateSpeech(cleanContent);
    } catch (error) {
      console.error("Chat Error:", error);
      const errorMessage: Message = { 
        role: 'model', 
        content: "Désolé Christiane, j'ai rencontré une petite difficulté technique lors de l'analyse. Peux-tu réessayer ?", 
        timestamp: new Date() 
      };
      const finalWithErr = [...updatedWithUser, errorMessage];
      updateActiveSession(finalWithErr);
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

  const printHistory = () => {
    window.print();
  };

  const startNewSession = (subject: string) => {
    const newSession: Session = {
      id: Math.random().toString(36).substring(2, 15),
      subject,
      title: `${subject} - ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
      messages: [],
      timestamp: new Date()
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setActiveSubject(subject);
    setIsSidebarOpen(false);
    
    // Trigger initial greeting for the new session
    setTimeout(() => {
      handleInitialGreeting();
    }, 100);
  };

  const loadSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setActiveSessionId(sessionId);
      setActiveSubject(session.subject);
      setIsSidebarOpen(false);
    }
  };

  const clearHistory = () => {
    if (activeSessionId) {
      setSessions(prev => prev.filter(s => s.id !== activeSessionId));
      setActiveSessionId(null);
      setActiveSubject(null);
      // Re-initialize chat
      chatRef.current = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });
    }
  };

  const selectSubject = (subjectName: string) => {
    // Check if there's an existing session for this subject
    const existingSession = sessions.find(s => s.subject === subjectName);
    if (existingSession) {
      loadSession(existingSession.id);
    } else {
      startNewSession(subjectName);
    }
  };

  return (
    <div className="flex h-[100dvh] bg-[#f8f9fa] overflow-hidden safe-top safe-bottom">
      {/* Sidebar - Right Block for Subjects and Info */}
      <aside className={cn(
        "fixed inset-y-0 right-0 z-40 w-[300px] sm:w-[380px] bg-slate-900 text-white flex flex-col border-l border-slate-800 transition-transform duration-300 lg:relative lg:translate-x-0 order-2",
        isSidebarOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Scale className="text-white w-5 h-5" />
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
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-slate-800">
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Candidate</p>
            <p className="text-sm font-semibold text-white">Christiane Endalle</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <section>
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <BookOpen size={12} className="text-indigo-500" /> Matières à réviser
            </h2>
            <div className="space-y-2">
              {SUBJECTS.map((sub) => {
                const subjectSessions = sessions.filter(s => s.subject === sub.name);
                return (
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
                    <div className="flex-1 min-w-0">
                      <span className={cn(
                        "text-xs font-semibold leading-tight block truncate",
                        activeSubject === sub.name ? "text-white" : "text-slate-300 group-hover:text-white"
                      )}>
                        {sub.name}
                      </span>
                      {subjectSessions.length > 0 && (
                        <span className="text-[9px] text-indigo-300/60 font-medium">
                          {subjectSessions.length} session(s) active(s)
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {sessions.length > 0 && (
            <section>
              <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <RefreshCw size={12} className="text-indigo-500" /> Historique des Sauvegardes
              </h2>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => loadSession(s.id)}
                    className={cn(
                      "w-full flex flex-col p-2.5 rounded-lg transition-all text-left border text-[10px]",
                      activeSessionId === s.id
                        ? "bg-indigo-600/20 border-indigo-500/30 text-white"
                        : "bg-slate-800/20 border-slate-700/30 text-slate-400 hover:bg-slate-800/40"
                    )}
                  >
                    <span className="font-bold truncate w-full">{s.title}</span>
                    <span className="opacity-50">{s.messages.length} messages</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeSubject && (
            <section className="pt-4 border-t border-slate-800 space-y-2">
              <button
                onClick={() => startNewSession(activeSubject)}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all text-[10px] font-bold uppercase tracking-wider"
              >
                <RefreshCw size={14} /> Nouvelle Session
              </button>
              <button
                onClick={printHistory}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-all text-[10px] font-bold uppercase tracking-wider"
              >
                <FileText size={14} /> Exporter en PDF
              </button>
              <button
                onClick={clearHistory}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-[10px] font-bold uppercase tracking-wider"
              >
                <Trash2 size={14} /> Supprimer cette session
              </button>
            </section>
          )}

          <section className="bg-indigo-600/5 rounded-2xl p-4 border border-indigo-500/10">
            <h3 className="text-xs font-bold text-indigo-400 mb-2 flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin-slow" /> Compte à rebours
            </h3>
            <div className="flex justify-between text-center">
              <div>
                <p className="text-lg font-bold text-white">
                  {Math.max(0, Math.floor((new Date('2026-04-18').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))}
                </p>
                <p className="text-[8px] text-slate-500 uppercase font-bold">Jours</p>
              </div>
              <div className="w-px h-8 bg-slate-800 self-center" />
              <div className="flex-1 px-2">
                <p className="text-[10px] text-slate-400 font-medium leading-tight">
                  Avant le grand jour (18 Avril 2026)
                </p>
              </div>
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
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900/50">
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
              <span className="hidden sm:inline">{isTtsEnabled ? "Voix Active" : "Voix Muette"}</span>
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Nouvelle session"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Block - Chatbot and Discussion */}
      <main className="flex-1 flex flex-col bg-white order-1 relative min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between p-4 border-b border-slate-100 bg-white sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <Scale className="text-indigo-600 w-5 h-5" />
            <span className="font-bold text-slate-900 text-sm">Coach Barreau</span>
          </div>
          <div className="flex items-center gap-2">
            {activeSubject && (
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full truncate max-w-[120px]">
                {activeSubject}
              </span>
            )}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg"
            >
              <Menu size={20} />
            </button>
          </div>
        </header>
        {!isStarted && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/30 mb-6 animate-bounce">
              <Scale className="text-white w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Prête pour vos révisions ?</h2>
            <p className="text-sm text-slate-500 max-w-sm mb-8 leading-relaxed">
              Bienvenue Christiane. Je suis votre Coach personnel pour le Barreau 2026. 
              Cliquez ci-dessous pour commencer notre session.
            </p>
            <button 
              onClick={startSession}
              className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-base hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
            >
              Commencer la session
            </button>
          </div>
        )}

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 sm:p-10 space-y-6 sm:space-y-10 scroll-smooth"
        >
          {messages.length === 0 && !isTyping && (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60">
              <BookOpen size={48} className="text-indigo-200 mb-4" />
              <h3 className="text-lg font-bold text-slate-400">Choisissez une matière</h3>
              <p className="text-sm text-slate-400 max-w-[200px]">Sélectionnez un sujet dans le menu pour commencer ou reprendre vos révisions.</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div 
              key={i} 
              className={cn(
                "flex w-full animate-in fade-in slide-in-from-bottom-4 duration-500",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "flex gap-3 sm:gap-4 max-w-[90%] sm:max-w-[85%]",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}>
                <div className={cn(
                  "w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm mt-0.5 overflow-hidden border border-slate-200",
                  msg.role === 'user' ? "bg-slate-100" : "bg-indigo-600 shadow-lg shadow-indigo-500/20"
                )}>
                  {msg.role === 'user' ? (
                    <img 
                      src="https://i.postimg.cc/cJQfnr2V/Whats-App-Image-2025-09-10-at-11-07-09-(1).jpg" 
                      alt="Christiane" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Scale className="text-white w-5 h-5" />
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
                    "p-3.5 rounded-2xl shadow-sm border leading-relaxed",
                    msg.role === 'user' 
                      ? "bg-white border-slate-200 text-slate-800 rounded-tr-none" 
                      : "bg-indigo-50/50 border-indigo-100 text-slate-900 rounded-tl-none"
                  )}>
                    <div className="markdown-body prose prose-slate max-w-none prose-p:leading-relaxed prose-strong:text-indigo-900 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                      <Markdown>
                        {msg.content}
                      </Markdown>
                    </div>

                    {msg.synthesis && (
                      <div className="mt-4 pt-4 border-t border-indigo-100">
                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <FileText size={12} /> Synthèse disponible
                        </p>
                        <button
                          onClick={() => generatePDF(msg.synthesis!)}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
                        >
                          <Download size={14} /> Télécharger le Corrigé (PDF)
                        </button>
                      </div>
                    )}

                    <div className={cn(
                      "text-[10px] mt-4 font-bold opacity-30 uppercase tracking-[0.15em]",
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
              <div className="flex gap-3 sm:gap-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Loader2 className="text-white w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                </div>
                <div className="bg-indigo-50/50 border border-indigo-100 p-3 sm:p-5 rounded-2xl sm:rounded-[2rem] rounded-tl-none flex items-center gap-2">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 sm:p-6 bg-white border-t border-slate-100">
          {selectedFile && (
            <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-indigo-50 border border-indigo-100 rounded-xl sm:rounded-2xl flex items-center justify-between animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-white rounded-lg sm:rounded-xl text-indigo-600 shadow-sm">
                  <File size={16} />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-700 truncate max-w-[150px] sm:max-w-[250px]">{selectedFile.file.name}</p>
                  <p className="text-[9px] sm:text-[10px] text-indigo-500 uppercase font-bold tracking-wider">Document prêt</p>
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
          
          <form onSubmit={handleSend} className="relative flex items-center gap-2 sm:gap-3">
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
              className="p-2.5 sm:p-3.5 rounded-lg sm:rounded-xl bg-slate-50 text-slate-400 border border-slate-200 hover:text-indigo-600 hover:border-indigo-200 transition-all hover:bg-white hover:shadow-sm"
              title="Ajouter un document"
            >
              <Paperclip size={18} />
            </button>
            <button
              type="button"
              onClick={toggleListening}
              className={cn(
                "p-2.5 sm:p-3.5 rounded-lg sm:rounded-xl transition-all duration-300 border",
                isListening 
                  ? "bg-red-500 text-white border-red-600 animate-pulse shadow-lg shadow-red-200" 
                  : "bg-slate-50 text-slate-400 border-slate-200 hover:text-indigo-600 hover:border-indigo-200 hover:bg-white hover:shadow-sm"
              )}
              title={isListening ? "Arrêter l'écoute" : "Parler au Coach"}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "Écoute..." : "Répondez..."}
              className={cn(
                "flex-1 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-3 sm:px-6 py-2.5 sm:py-3.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm sm:text-base",
                isListening && "placeholder:text-red-400"
              )}
            />
            <button
              id="send-button"
              type="submit"
              disabled={(!input.trim() && !selectedFile) || isTyping}
              className="bg-indigo-600 text-white p-2.5 sm:p-3.5 rounded-lg sm:rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-200"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </main>

      {/* Hidden Audio Element */}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
