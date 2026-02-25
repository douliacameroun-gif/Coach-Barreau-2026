import React, { useState, useEffect } from 'react';

const App = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [showScore, setShowScore] = useState(false);
  const [timeLeft, setTimeLeft] = useState({});

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

  useEffect(() => {
    const targetDate = new Date("April 18, 2026 08:00:00").getTime();
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate - now;
      setTimeLeft({
        jours: Math.floor(difference / (1000 * 60 * 60 * 24)),
        heures: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        min: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        sec: Math.floor((difference % (1000 * 60)) / 1000),
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAnswer = (isCorrect) => {
    if (isCorrect) setScore(score + 1);
    const next = currentQuestion + 1;
    if (next < questions.length) setCurrentQuestion(next);
    else setShowScore(true);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center py-12 px-4">
      {/* Header Pro */}
      <div className="max-w-3xl w-full text-center mb-10">
        <h1 className="text-4xl font-extrabold text-[#064e3b] tracking-tight">COACH BARREAU 2026</h1>
        <div className="h-1 w-24 bg-[#b45309] mx-auto mt-4 rounded-full"></div>
        <p className="mt-4 text-slate-500 font-medium">Réussir son examen avec l'IA de DOULIA</p>
      </div>

      {/* Timer Cards */}
      <div className="flex gap-4 mb-10 overflow-x-auto">
        {Object.entries(timeLeft).map(([unit, value]) => (
          <div key={unit} className="bg-white border-b-4 border-[#b45309] shadow-md rounded-xl p-4 min-w-[80px] text-center">
            <span className="block text-2xl font-black text-[#064e3b]">{value || 0}</span>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-tighter">{unit}</span>
          </div>
        ))}
      </div>

      {/* Quiz Container */}
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
        <div className="bg-[#064e3b] p-6 text-white flex justify-between items-center">
          <span className="text-sm font-bold opacity-80 underline decoration-[#b45309] decoration-2">DROIT PÉNAL</span>
          <span className="text-xs bg-black/20 px-3 py-1 rounded-full font-mono">Q: {currentQuestion + 1}/{questions.length}</span>
        </div>

        <div className="p-8">
          {showScore ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🎓</div>
              <h2 className="text-3xl font-bold text-[#064e3b]">Score : {score}/{questions.length}</h2>
              <p className="mt-4 text-slate-600 italic">Christiane, chaque effort aujourd'hui prépare ta victoire du 18 avril.</p>
              <button onClick={() => window.location.reload()} className="mt-8 bg-[#b45309] hover:bg-[#92400e] text-white font-bold py-3 px-10 rounded-full transition-transform hover:scale-105 shadow-lg">Recommencer</button>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-slate-800 mb-8 leading-tight">{questions[currentQuestion].questionText}</h2>
              <div className="space-y-4">
                {questions[currentQuestion].answerOptions.map((option, i) => (
                  <button key={i} onClick={() => handleAnswer(option.isCorrect)} className="w-full text-left p-5 rounded-2xl border-2 border-slate-50 hover:border-[#064e3b] hover:bg-emerald-50/50 transition-all flex items-center group">
                    <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-[#064e3b] group-hover:text-white flex items-center justify-center font-bold mr-4 shrink-0 transition-colors">{i + 1}</div>
                    <span className="text-slate-700 font-medium">{option.answerText}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-12 text-center text-sm text-slate-400 font-medium">
        <p>📅 Concours : 18 & 19 Avril 2026 | 📍 Yaoundé, Cameroun</p>
        <p className="mt-2 text-[#064e3b]/60 italic italic">Doulia Connect - L'excellence au service du droit</p>
      </div>
    </div>
  );
};

export default App;