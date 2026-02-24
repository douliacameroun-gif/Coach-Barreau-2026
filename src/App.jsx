
import React, { useState, useEffect } from 'react';

const Countdown = () => {
  const calculateTimeLeft = () => {
    const difference = +new Date('2026-04-18T00:00:00') - +new Date();
    let timeLeft = {};

    if (difference > 0) {
      timeLeft = {
        jours: Math.floor(difference / (1000 * 60 * 60 * 24)),
        heures: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        secondes: Math.floor((difference / 1000) % 60),
      };
    }

    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearTimeout(timer);
  });

  const timerComponents = [];

  Object.keys(timeLeft).forEach((interval) => {
    if (!timeLeft[interval]) {
      return;
    }

    timerComponents.push(
      <span key={interval} className="text-center">
        <div className="text-4xl font-bold text-green-800">{timeLeft[interval]}</div>
        <div className="text-sm uppercase text-gray-500">{interval}</div>
      </span>
    );
  });

  return (
    <div className="flex justify-center space-x-4 my-8">
      {timerComponents.length ? timerComponents : <span>Temps écoulé!</span>}
    </div>
  );
};

const quizData = {
  "Droit Pénal": [
    { question: "Qu'est-ce qu'une infraction pénale ?", options: ["Un délit civil", "Un acte interdit par la loi et puni d'une peine", "Une violation de contrat", "Un manquement à une obligation morale"], correctAnswer: "Un acte interdit par la loi et puni d'une peine" },
    { question: "Quelles sont les trois catégories d'infractions en France ?", options: ["Crimes, délits, contraventions", "Fautes, erreurs, négligences", "Infractions simples, complexes, continues", "Délits de droit commun, délits politiques, délits militaires"], correctAnswer: "Crimes, délits, contraventions" },
    { question: "Quelle est la peine maximale pour un crime en France ?", options: ["10 ans de prison", "20 ans de prison", "La réclusion criminelle à perpétuité", "La peine de mort"], correctAnswer: "La réclusion criminelle à perpétuité" },
    { question: "Qu'est-ce que la légitime défense ?", options: ["Le droit de se venger", "Un fait justificatif qui autorise une personne à commettre une infraction pour se défendre", "Une excuse pour un acte violent", "Une circonstance aggravante"], correctAnswer: "Un fait justificatif qui autorise une personne à commettre une infraction pour se défendre" },
    { question: "Qu'est-ce que la garde à vue ?", options: ["Une peine de prison", "Une mesure de contrainte par laquelle une personne est retenue par la police judiciaire", "Une audition de témoin", "Une convocation au tribunal"], correctAnswer: "Une mesure de contrainte par laquelle une personne est retenue par la police judiciaire" },
  ],
  "Procédure Civile": [
    { question: "Quel tribunal est compétent pour les litiges entre particuliers ?", options: ["Le tribunal de commerce", "Le conseil de prud'hommes", "Le tribunal judiciaire", "La cour d'assises"], correctAnswer: "Le tribunal judiciaire" },
    { question: "Qu'est-ce qu'une assignation ?", options: ["Une convocation au tribunal", "L'acte par lequel le demandeur saisit le tribunal et informe le défendeur de ses prétentions", "Un jugement", "Une expertise"], correctAnswer: "L'acte par lequel le demandeur saisit le tribunal et informe le défendeur de ses prétentions" },
    { question: "Qu'est-ce que l'appel ?", options: ["Une nouvelle demande en justice", "La voie de recours qui permet de faire réexaminer une affaire par une juridiction supérieure", "Une demande de dommages et intérêts", "Une mesure d'instruction"], correctAnswer: "La voie de recours qui permet de faire réexaminer une affaire par une juridiction supérieure" },
    { question: "Quel est le délai pour faire appel d'un jugement ?", options: ["15 jours", "1 mois", "2 mois", "6 mois"], correctAnswer: "1 mois" },
    { question: "Qu'est-ce qu'un pourvoi en cassation ?", options: ["Un troisième degré de juridiction", "Un recours visant à faire contrôler la bonne application du droit par les juges du fond", "Une demande de révision du procès", "Une expertise"], correctAnswer: "Un recours visant à faire contrôler la bonne application du droit par les juges du fond" },
  ],
  "Droit Administratif": [
    { question: "Qu'est-ce qu'un acte administratif unilatéral ?", options: ["Un contrat entre l'administration et un particulier", "Une décision prise par l'administration qui s'impose aux administrés", "Un jugement du tribunal administratif", "Une loi"], correctAnswer: "Une décision prise par l'administration qui s'impose aux administrés" },
    { question: "Quel est le principal recours contre un acte administratif ?", options: ["Le recours pour excès de pouvoir", "L'appel", "Le pourvoi en cassation", "La saisine du Conseil constitutionnel"], correctAnswer: "Le recours pour excès de pouvoir" },
    { question: "Qu'est-ce que le service public ?", options: ["Une activité d'intérêt général assurée par une personne publique", "Une entreprise privée", "Une association", "Un syndicat"], correctAnswer: "Une activité d'intérêt général assurée par une personne publique" },
    { question: "Qu'est-ce qu'un contrat administratif ?", options: ["Un contrat conclu entre deux personnes privées", "Un contrat conclu par au moins une personne publique et qui répond à des critères spécifiques", "Un accord verbal", "Un gentlemen's agreement"], correctAnswer: "Un contrat conclu par au moins une personne publique et qui répond à des critères spécifiques" },
    { question: "Quelle juridiction est compétente pour les litiges relatifs aux contrats administratifs ?", options: ["Le tribunal judiciaire", "Le tribunal de commerce", "Le tribunal administratif", "Le conseil de prud'hommes"], correctAnswer: "Le tribunal administratif" },
  ]
};

const Quiz = () => {
  const [currentSubject, setCurrentSubject] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showScore, setShowScore] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);

  const handleSubjectChange = (subject) => {
    setCurrentSubject(subject);
    setCurrentQuestionIndex(0);
    setScore(0);
    setShowScore(false);
    setSelectedAnswer(null);
  };

  const handleAnswerOptionClick = (option) => {
    setSelectedAnswer(option);
    if (option === quizData[currentSubject][currentQuestionIndex].correctAnswer) {
      setScore(score + 1);
    }
  };

  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    const nextQuestion = currentQuestionIndex + 1;
    if (nextQuestion < quizData[currentSubject].length) {
      setCurrentQuestionIndex(nextQuestion);
    } else {
      setShowScore(true);
    }
  };
  
  const restartQuiz = () => {
    setCurrentSubject(null);
  }

  return (
    <div className="w-full max-w-3xl p-8 mx-auto space-y-8 bg-white rounded-lg shadow-md">
      {!currentSubject ? (
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-green-900">Choisissez une matière</h2>
          <div className="flex justify-center space-x-4">
            {Object.keys(quizData).map(subject => (
              <button key={subject} onClick={() => handleSubjectChange(subject)} className="bg-green-700 hover:bg-green-800 text-white font-bold py-2 px-4 rounded">
                {subject}
              </button>
            ))}
          </div>
        </div>
      ) : showScore ? (
        <div className="text-center">
          <h2 className="text-2xl font-bold text-green-900">Votre score est de {score} sur {quizData[currentSubject].length}</h2>
           <button onClick={restartQuiz} className="bg-green-700 hover:bg-green-800 text-white font-bold py-2 px-4 rounded mt-4">
                Recommencer le quiz
            </button>
        </div>
      ) : (
        <div>
          <h2 className="text-2xl font-bold text-green-900">{quizData[currentSubject][currentQuestionIndex].question}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {quizData[currentSubject][currentQuestionIndex].options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerOptionClick(option)}
                className={`p-4 rounded-lg border-2 ${selectedAnswer === option ? (option === quizData[currentSubject][currentQuestionIndex].correctAnswer ? 'border-green-500 bg-green-100' : 'border-red-500 bg-red-100') : 'border-gray-300'}`}
                disabled={selectedAnswer !== null}
              >
                {option}
              </button>
            ))}
          </div>
          {selectedAnswer && (
             <button onClick={handleNextQuestion} className="bg-green-700 hover:bg-green-800 text-white font-bold py-2 px-4 rounded mt-4">
                Question suivante
            </button>
          )}
        </div>
      )}
    </div>
  );
};


const EncouragementMessage = () => {
  return (
    <div className="mt-8 text-lg text-center text-gray-700 p-4 bg-yellow-100 border-l-4 border-yellow-500">
      <p className="font-bold">N'oubliez pas !</p>
      <p>Le dépôt des dossiers pour le Barreau 2026 se termine le <span className="font-semibold text-green-800">16 mars 2026</span>.</p>
      <p>Tenez bon, vous êtes sur la bonne voie !</p>
    </div>
  );
};


function App() {
  return (
    <div className="bg-gray-100 min-h-screen text-gray-800 font-sans">
      <header className="bg-green-900 text-white p-4 shadow-md">
          <h1 className="text-4xl text-center font-bold text-yellow-300">Coach Barreau 2026</h1>
      </header>
      
      <main className="p-8">
        <Countdown />
        <Quiz />
        <EncouragementMessage />
      </main>

       <footer className="text-center p-4 text-gray-500 text-sm">
        <p>Développé avec ❤️ pour les futurs avocats.</p>
      </footer>
    </div>
  )
}

export default App
