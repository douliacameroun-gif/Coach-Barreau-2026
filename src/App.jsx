import React, { useState, useEffect } from 'react';
import './index.css';

const App = () => {
  // --- ÉTAT DU QUIZ ---
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [showScore, setShowScore] = useState(false);
  const [timeLeft, setTimeLeft] = useState({});

  // --- DONNÉES DU QUIZ (Droit Pénal) ---
  const questions = [
    {
      questionText: "Quelles sont les trois catégories d'infractions en droit pénal ?",
      answerOptions: [
        { answerText: "Crimes, délits, contraventions", isCorrect: true },
        { answerText: "Fautes, erreurs, négligences", isCorrect: false },
        { answerText: "Infractions simples, complexes, continues", isCorrect: false },
        { answerText: "Délits de droit commun, politiques, militaires", isCorrect: false },
      ],
    },
    {
      questionText: "Quel est l'élément moral nécessaire pour constituer une infraction ?",
      answerOptions: [
        { answerText: "L'intention ou la faute", isCorrect: true },
        { answerText: "Le préjudice causé", isCorrect: false },
        { answerText: "L'acte matériel uniquement", isCorrect: false },
        { answerText: "La présence d'un témoin", isCorrect: false },
      ],
    }
  ];

  // --- LOGIQUE DU COMPTE À REBOURS ---
  useEffect(() => {
    const targetDate = new Date("April 18, 2026 08:00:00").getTime();
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      setTimeLeft({
        jours: Math.floor(difference / (1000 * 60 * 60 * 24)),
        heures: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        secondes: Math.floor((difference % (1000 * 60)) / 1000),
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAnswerOptionClick = (isCorrect) => {
    if (isCorrect) setScore(score + 1);
    const nextQuestion = currentQuestion + 1;
    if (nextQuestion < questions.length) {
      setCurrentQuestion(nextQuestion);
    } else {
      setShowScore(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 font-sans text-slate-800">
      {/* Header & Vision DOULIA */}
      <header className="w-full max-w-2xl text-center my-8">
        <h1 className="text-4xl font-extrabold text-emerald-900 mb-2">Entraîneur Barreau 2026</h1>
        <p className="text-emerald-700 font-medium italic">Une solution propulsée par l'expertise DOULIA</p>
      </header>

      {/* Compte à rebours stylisé */}
      <div className="bg-emerald-900 text-white p-6 rounded-2xl shadow-xl w-full max-w-2xl mb-8 flex justify-around text-center border-b-4 border-amber-500">
        {Object.entries(timeLeft).map(([unit, value]) => (
          <div key={unit}>
            <span className="block text-3xl font-bold">{value || 0}</span>
            <span className="text-xs uppercase tracking-widest text-emerald-300">{unit}</span>
          </div>
        ))}
      </div>

      {/* Zone de Quiz */}
      <main className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-2xl border border-slate-200">
        {showScore ? (
          <div className="text-center py-10">
            <h2 className="text-3xl font-bold text-emerald-900 mb-4">Score : {score} / {questions.length}</h2>
            <p className="text-slate-600 mb-6">Continue tes révisions, Christiane. Le succès t'attend à Yaoundé !</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-8 rounded-full transition-all"
            >
              Recommencer
            </button>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <span className="text-amber-600 font-bold uppercase text-sm tracking-widest">Question {currentQuestion + 1} de {questions.length}</span>
              <h2 className="text-2xl font-semibold mt-2 leading-tight">{questions[currentQuestion].questionText}</h2>
            </div>
            <div className="grid gap-4">
              {questions[currentQuestion].answerOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerOptionClick(option.isCorrect)}
                  className="text-left p-4 rounded-xl border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                >
                  <span className="inline-block w-8 h-8 bg-slate-100 group-hover:bg-emerald-500 group-hover:text-white text-center leading-8 rounded-full mr-3 font-bold">{index + 1}</span>
                  {option.answerText}
                </button>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Rappels Importants */}
      <footer className="mt-12 text-center text-slate-500 max-w-md">
        <p className="mb-2">⚠️ <span className="font-bold">Rappel :</span> Dépôt des dossiers au Barreau avant le <span className="text-emerald-700 font-bold">16 mars 2026</span>.</p>
        <p className="text-sm">Développé avec ❤️ pour l'avenir du droit au Cameroun.</p>
      </footer>
    </div>
  );
};

export default App;