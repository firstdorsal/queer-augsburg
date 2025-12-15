// Quiz Board - Display view for participants/audience

import { useState, useEffect, useRef } from 'react';
import { useQuizStore } from './useQuizStore';
import { QuizQuestion, QuizCategory, QuizTeam } from './types';
import './quiz.scss';

interface QuestionCellProps {
  question: QuizQuestion;
  teams: QuizTeam[];
}

function QuestionCell({ question, teams }: QuestionCellProps) {
  const answeredTeam = question.answeredBy
    ? teams.find(t => t.id === question.answeredBy)
    : null;

  if (question.revealed) {
    return (
      <div
        className="quiz-cell quiz-cell--revealed"
        style={answeredTeam ? { backgroundColor: answeredTeam.color } : undefined}
      >
        <span className="quiz-cell__points quiz-cell__points--small">{question.points}</span>
        {answeredTeam && <span className="quiz-cell__team">{answeredTeam.name}</span>}
      </div>
    );
  }

  return (
    <div className="quiz-cell">
      <span className="quiz-cell__points">{question.points}</span>
    </div>
  );
}

interface CategoryColumnProps {
  category: QuizCategory;
  teams: QuizTeam[];
}

function CategoryColumn({ category, teams }: CategoryColumnProps) {
  return (
    <div className="quiz-column">
      <div className="quiz-column__header">
        {category.name}
      </div>
      {category.questions.map(question => (
        <QuestionCell key={question.id} question={question} teams={teams} />
      ))}
    </div>
  );
}

interface TeamScoreProps {
  team: QuizTeam;
}

function TeamScore({ team }: TeamScoreProps) {
  return (
    <div className="quiz-team" style={{ borderColor: team.color }}>
      <div className="quiz-team__color" style={{ backgroundColor: team.color }} />
      <div className="quiz-team__info">
        <span className="quiz-team__name">{team.name}</span>
        <span className="quiz-team__score">{team.score}</span>
      </div>
    </div>
  );
}

interface QuestionOverlayProps {
  question: QuizQuestion | null;
  showAnswer: boolean;
}

function QuestionOverlay({ question, showAnswer }: QuestionOverlayProps) {
  if (!question) return null;

  return (
    <div className="quiz-overlay">
      <div className="quiz-overlay__content">
        <div className="quiz-overlay__points">{question.points} Punkte</div>
        <div className="quiz-overlay__question">
          {question.question || 'Keine Frage eingetragen'}
        </div>
        {showAnswer && (
          <div className="quiz-overlay__answer">
            <div className="quiz-overlay__answer-label">Antwort:</div>
            {question.answer || 'Keine Antwort eingetragen'}
          </div>
        )}
      </div>
    </div>
  );
}

// Confetti component
function Confetti({ team }: { team: QuizTeam | null }) {
  if (!team) return null;

  const confettiPieces = Array.from({ length: 400 }, (_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 0.5;
    const duration = 2 + Math.random() * 2;
    const size = 8 + Math.random() * 8;
    const rotation = Math.random() * 360;

    return (
      <div
        key={i}
        className="confetti-piece"
        style={{
          left: `${left}%`,
          backgroundColor: team.color,
          width: size,
          height: size * 0.6,
          animationDelay: `${delay}s`,
          animationDuration: `${duration}s`,
          transform: `rotate(${rotation}deg)`,
        }}
      />
    );
  });

  return <div className="confetti-container">{confettiPieces}</div>;
}

export default function QuizBoard() {
  const state = useQuizStore();
  const [confettiTeam, setConfettiTeam] = useState<QuizTeam | null>(null);
  const prevRevealedRef = useRef<Set<string>>(new Set());

  const currentQuestion = state.currentQuestion
    ? state.categories
        .flatMap(c => c.questions)
        .find(q => q.id === state.currentQuestion) ?? null
    : null;

  // Track newly revealed questions to trigger confetti
  useEffect(() => {
    const currentRevealed = new Set(
      state.categories
        .flatMap(c => c.questions)
        .filter(q => q.revealed && q.answeredBy)
        .map(q => q.id)
    );

    // Find newly revealed questions
    for (const id of currentRevealed) {
      if (!prevRevealedRef.current.has(id)) {
        // Find the question and team
        const question = state.categories
          .flatMap(c => c.questions)
          .find(q => q.id === id);
        if (question?.answeredBy) {
          const team = state.teams.find(t => t.id === question.answeredBy);
          if (team) {
            setConfettiTeam(team);
            setTimeout(() => setConfettiTeam(null), 4000);
          }
        }
      }
    }

    prevRevealedRef.current = currentRevealed;
  }, [state.categories, state.teams]);

  return (
    <div className="quiz-board">
      <div className="quiz-board__teams">
        {state.teams.map(team => (
          <TeamScore key={team.id} team={team} />
        ))}
      </div>

      <div className="quiz-board__grid">
        {state.categories.map(category => (
          <CategoryColumn key={category.id} category={category} teams={state.teams} />
        ))}
      </div>

      <QuestionOverlay question={currentQuestion} showAnswer={state.showAnswer} />
      <Confetti team={confettiTeam} />
    </div>
  );
}
