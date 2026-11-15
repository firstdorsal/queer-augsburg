// Quiz Control - Admin view for quiz host

import { useState, useEffect } from 'react';
import type { JSX } from 'preact';
import {
  Button,
  ButtonGroup,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Message,
  NumberInput,
  Panel,
  Textarea,
  toaster
} from '../components/ui';
import { useQuizStore, quizStore } from './useQuizStore';
import { QuizQuestion, QuizCategory, QuizTeam } from './types';
import './quiz.scss';

// Team Editor Component
function TeamEditor({ team }: { team: QuizTeam }) {
  return (
    <div className="qm-team" style={{ borderColor: team.color }}>
      <input
        type="color"
        value={team.color}
        onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => quizStore.updateTeam(team.id, { color: e.currentTarget.value })}
        className="qm-team__color"
      />
      <Input
        value={team.name}
        onValueChange={(value) => quizStore.updateTeam(team.id, { name: value })}
        style={{ flex: 1, minWidth: 120 }}
      />
      <ButtonGroup>
        <Button size="sm" onClick={() => quizStore.adjustTeamScore(team.id, -100)}>-100</Button>
        <NumberInput
          aria-label={`Punkte von ${team.name}`}
          value={team.score}
          onValueChange={(value) => quizStore.setTeamScore(team.id, Number(value) || 0)}
          style={{ width: 100 }}
        />
        <Button size="sm" onClick={() => quizStore.adjustTeamScore(team.id, 100)}>+100</Button>
      </ButtonGroup>
      <Button
        tone="red"
        variant="subtle"
        onClick={() => quizStore.removeTeam(team.id)}
        title="Team entfernen"
      >
        ×
      </Button>
    </div>
  );
}

// Category Header Editor
function CategoryHeader({ category }: { category: QuizCategory }) {
  return (
    <div className="qm-category-header">
      <Input
        value={category.name}
        onValueChange={(value) => quizStore.updateCategory(category.id, value)}
        className="qm-category-header__input"
      />
      <Button
        tone="red"
        variant="subtle"
        size="sm"
        onClick={() => quizStore.removeCategory(category.id)}
        title="Kategorie entfernen"
      >
        ×
      </Button>
    </div>
  );
}

// Question Editor Modal
interface QuestionEditorModalProps {
  question: QuizQuestion | null;
  onClose: () => void;
}

function QuestionEditorModal({ question, onClose }: QuestionEditorModalProps) {
  const [localQuestion, setLocalQuestion] = useState(question?.question ?? '');
  const [localAnswer, setLocalAnswer] = useState(question?.answer ?? '');
  const [localNotes, setLocalNotes] = useState(question?.notes ?? '');

  // Sync state when question changes
  useEffect(() => {
    if (question) {
      setLocalQuestion(question.question);
      setLocalAnswer(question.answer);
      setLocalNotes(question.notes ?? '');
    }
  }, [question]);

  if (!question) return null;

  const handleSave = () => {
    quizStore.updateQuestion(question.id, {
      question: localQuestion,
      answer: localAnswer,
      notes: localNotes,
    });
    onClose();
  };

  return (
    <Dialog open={!!question} onClose={onClose} size="md">
      <DialogHeader>
        <DialogTitle>{question.points} Punkte - Frage bearbeiten</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Frage:</label>
          <Textarea
            rows={3}
            placeholder="Frage eingeben..."
            value={localQuestion}
            onValueChange={setLocalQuestion}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Antwort:</label>
          <Textarea
            rows={3}
            placeholder="Antwort eingeben..."
            value={localAnswer}
            onValueChange={setLocalAnswer}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>Notizen (nur für dich sichtbar):</label>
          <Textarea
            rows={3}
            placeholder="Links, Hinweise, etc."
            value={localNotes}
            onValueChange={setLocalNotes}
          />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose} variant="subtle">Abbrechen</Button>
        <Button onClick={handleSave} variant="primary">Speichern</Button>
      </DialogFooter>
    </Dialog>
  );
}

// Question Editor Cell
interface QuestionCellProps {
  question: QuizQuestion;
  teams: QuizTeam[];
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}

function QuestionEditorCell({ question, teams, isSelected, onSelect, onEdit }: QuestionCellProps) {
  const answeredTeam = question.answeredBy
    ? teams.find(t => t.id === question.answeredBy)
    : null;

  return (
    <div
      className={`qm-cell ${question.revealed ? 'qm-cell--revealed' : ''} ${isSelected ? 'qm-cell--selected' : ''}`}
      style={answeredTeam ? { borderColor: answeredTeam.color } : undefined}
    >
      <div className="qm-cell__points">{question.points}</div>
      <div className="qm-cell__preview">
        {question.question ? question.question.slice(0, 50) + (question.question.length > 50 ? '...' : '') : '(leer)'}
      </div>
      <div className="qm-cell__actions">
        <Button size="xs" onClick={onEdit}>Bearbeiten</Button>
        {!question.revealed && (
          <Button size="xs" variant={isSelected ? 'primary' : 'ghost'} onClick={onSelect}>
            {isSelected ? 'Abwählen' : 'Auswählen'}
          </Button>
        )}
      </div>
    </div>
  );
}

// Active Question Panel
interface ActiveQuestionPanelProps {
  question: QuizQuestion | null;
  teams: QuizTeam[];
  showAnswer: boolean;
}

// Helper to render text with clickable links
function renderWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
          {part}
        </a>
      );
    }
    return part;
  });
}

function ActiveQuestionPanel({ question, teams, showAnswer }: ActiveQuestionPanelProps) {
  if (!question) {
    return (
      <Panel bordered className="qm-active qm-active--empty">
        <p style={{ textAlign: 'center', color: '#888' }}>Keine Frage ausgewählt</p>
      </Panel>
    );
  }

  return (
    <Panel bordered className="qm-active">
      <div className="qm-active__header">
        <span className="qm-active__points">{question.points} Punkte</span>
        <Button variant="subtle" onClick={() => quizStore.selectQuestion(null)}>
          Schließen
        </Button>
      </div>

      <div className="qm-active__question">
        <strong>Frage:</strong> {question.question || '(keine Frage)'}
      </div>

      {question.notes && (
        <div className="qm-active__notes">
          <strong>Notizen:</strong>{' '}
          <span style={{ whiteSpace: 'pre-wrap' }}>{renderWithLinks(question.notes)}</span>
        </div>
      )}

      <div className="qm-active__controls">
        <Button
          variant={showAnswer ? 'primary' : 'ghost'}
          tone={showAnswer ? 'green' : undefined}
          onClick={() => quizStore.toggleAnswer()}
        >
          {showAnswer ? 'Antwort verbergen' : 'Antwort zeigen'}
        </Button>
      </div>

      {showAnswer && (
        <div className="qm-active__answer">
          <strong>Antwort:</strong> {question.answer || '(keine Antwort)'}
        </div>
      )}

      <div className="qm-active__award">
        <span>Punkte vergeben an:</span>
        <div className="qm-active__team-buttons">
          {teams.map(team => (
            <Button
              key={team.id}
              onClick={() => quizStore.revealQuestion(question.id, team.id)}
              style={{ backgroundColor: team.color, color: '#fff', borderColor: team.color }}
            >
              {team.name}
            </Button>
          ))}
          <Button
            variant="subtle"
            onClick={() => quizStore.revealQuestion(question.id, null)}
          >
            Niemand
          </Button>
        </div>
      </div>
    </Panel>
  );
}

// Import/Export Panel
function ImportExportPanel() {
  const state = useQuizStore();
  const [importText, setImportText] = useState('');

  const exportText = JSON.stringify(state, null, 2);

  const handleImport = () => {
    if (quizStore.importState(importText)) {
      setImportText('');
      toaster.push(<Message type="success">Import erfolgreich!</Message>, { duration: 3000 });
    } else {
      toaster.push(<Message type="error">Ungültiges Format</Message>, { duration: 3000 });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(exportText);
    toaster.push(<Message type="success">In Zwischenablage kopiert!</Message>, { duration: 2000 });
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Exportieren:</label>
        <Textarea
          rows={8}
          value={exportText}
          readOnly
          style={{ fontFamily: 'monospace', marginBottom: 8 }}
        />
        <Button onClick={handleCopy}>In Zwischenablage kopieren</Button>
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Importieren:</label>
        <Textarea
          rows={6}
          placeholder="JSON hier einfügen..."
          value={importText}
          onValueChange={setImportText}
          style={{ fontFamily: 'monospace', marginBottom: 8 }}
        />
        <Button variant="primary" onClick={handleImport} disabled={!importText.trim()}>
          Importieren
        </Button>
      </div>
    </div>
  );
}

// Main QuizControl Component
export default function QuizControl() {
  const state = useQuizStore();
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);

  const currentQuestion = state.currentQuestion
    ? state.categories
        .flatMap(c => c.questions)
        .find(q => q.id === state.currentQuestion) ?? null
    : null;

  const handleResetGame = () => {
    quizStore.resetGame();
    toaster.push(<Message type="info">Spiel zurückgesetzt</Message>, { duration: 3000 });
  };

  const handleResetAll = () => {
    if (confirm('Alle Daten werden gelöscht. Fortfahren?')) {
      quizStore.resetAll();
      toaster.push(<Message type="info">Alle Daten zurückgesetzt</Message>, { duration: 3000 });
    }
  };

  return (
    <div className="qm">
      <div className="qm__header">
        <h1>Quiz Control</h1>
        <ButtonGroup>
          <Button tone="orange" variant="primary" onClick={handleResetGame}>
            Spiel zurücksetzen
          </Button>
          <Button tone="red" variant="primary" onClick={handleResetAll}>
            Alles zurücksetzen
          </Button>
        </ButtonGroup>
      </div>

      {/* Active Question */}
      <ActiveQuestionPanel
        question={currentQuestion}
        teams={state.teams}
        showAnswer={state.showAnswer}
      />

      {/* Teams Section */}
      <Panel header="Teams" bordered collapsible defaultExpanded className="qm__section">
        <div className="qm__teams">
          {state.teams.map(team => (
            <TeamEditor key={team.id} team={team} />
          ))}
          <Button variant="ghost" onClick={() => quizStore.addTeam()}>
            + Team hinzufügen
          </Button>
        </div>
      </Panel>

      {/* Board Grid */}
      <Panel
        header="Spielfeld"
        headerAction={
          <Button variant="ghost" size="sm" onClick={() => quizStore.addCategory()}>
            + Kategorie
          </Button>
        }
        bordered
        collapsible
        defaultExpanded
        className="qm__section"
      >
        <div className="qm__grid">
          {state.categories.map(category => (
            <div key={category.id} className="qm__column">
              <CategoryHeader category={category} />
              {category.questions.map(question => (
                <QuestionEditorCell
                  key={question.id}
                  question={question}
                  teams={state.teams}
                  isSelected={state.currentQuestion === question.id}
                  onSelect={() => quizStore.selectQuestion(state.currentQuestion === question.id ? null : question.id)}
                  onEdit={() => setEditingQuestion(question)}
                />
              ))}
            </div>
          ))}
        </div>
      </Panel>

      {/* Import/Export */}
      <Panel header="Import / Export" bordered collapsible className="qm__section">
        <ImportExportPanel />
      </Panel>

      {/* Board Link */}
      <Panel header="Anzeigetafel" bordered collapsible className="qm__section">
        <p>Öffne die Anzeigetafel in einem neuen Fenster:</p>
        <Button variant="primary" href="/quiz/board" target="_blank">
          Anzeigetafel öffnen →
        </Button>
      </Panel>

      {/* Question Editor Modal */}
      <QuestionEditorModal
        question={editingQuestion}
        onClose={() => setEditingQuestion(null)}
      />
    </div>
  );
}
