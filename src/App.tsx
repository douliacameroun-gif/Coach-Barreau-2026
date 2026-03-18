import React, { useState } from 'react';
import { Chat } from './components/Chat';
import { Methodology } from './components/Methodology';
import { Tab } from './types';
import { Scale, BookOpen, GraduationCap, Calendar, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('revisions');

  const daysLeft = Math.max(0, Math.floor((new Date('2026-04-18').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="min-h-screen bg-stone-100 font-sans text-stone-900 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-stone-900 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight uppercase">Coach Barreau 2026</h1>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Session Christiane Endalle</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <div className="flex items-center gap-3 bg-stone-50 px-4 py-2 rounded-full border border-stone-200">
              <Calendar className="w-4 h-4 text-stone-400" />
              <span className="text-sm font-bold text-stone-600">
                {daysLeft} jours avant l'examen
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 flex gap-8">
          <button
            onClick={() => setActiveTab('revisions')}
            className={`py-5 px-2 text-sm font-black uppercase tracking-widest transition-all relative ${
              activeTab === 'revisions' ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              Révisions
            </div>
            {activeTab === 'revisions' && (
              <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-stone-900" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('methodologie')}
            className={`py-5 px-2 text-sm font-black uppercase tracking-widest transition-all relative ${
              activeTab === 'methodologie' ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Méthodologie
            </div>
            {activeTab === 'methodologie' && (
              <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-stone-900" />
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 flex flex-col">
        <AnimatePresence mode="wait">
          {activeTab === 'revisions' ? (
            <motion.div
              key="revisions"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 flex flex-col"
            >
              <div className="mb-6 flex items-center justify-between bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                <div className="flex items-center gap-3 text-emerald-800">
                  <Info className="w-5 h-5" />
                  <p className="text-sm font-medium">
                    Christiane, choisissez une matière pour commencer votre entraînement intensif.
                  </p>
                </div>
              </div>
              <div className="flex-1 min-h-[600px]">
                <Chat />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="methodologie"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1"
            >
              <div className="mb-8">
                <h2 className="text-3xl font-black text-stone-900 mb-2">Guide Méthodologique</h2>
                <p className="text-stone-500 font-medium">Maîtrisez les formats d'examen essentiels pour le Barreau 2026.</p>
              </div>
              <Methodology />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-500 py-8 px-6 border-t border-stone-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs font-bold uppercase tracking-widest">© 2026 Coach Barreau - Excellence Juridique</p>
          <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest">
            <span>Droit Camerounais</span>
            <span>Session 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
