// Quiz Store - localStorage-based state management with cross-tab sync

import { QuizState, QuizTeam, QuizCategory, QuizQuestion, createDefaultState, createDefaultQuestions, DEFAULT_COLORS, POINT_VALUES } from './types';

const STORAGE_KEY = 'quiz_state';

type Listener = (state: QuizState) => void;

class QuizStore {
  private listeners: Set<Listener> = new Set();
  private state: QuizState;

  constructor() {
    this.state = this.load();

    // Listen for changes from other tabs
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        this.state = JSON.parse(e.newValue);
        this.notify();
      }
    });
  }

  private load(): QuizState {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return createDefaultState();
      }
    }
    return createDefaultState();
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  private notify(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  private update(updater: (state: QuizState) => QuizState): void {
    this.state = updater(this.state);
    this.save();
    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): QuizState {
    return this.state;
  }

  // Team management
  addTeam(): void {
    this.update(state => {
      const teamNum = state.teams.length + 1;
      const colorIndex = (teamNum - 1) % DEFAULT_COLORS.length;
      const newTeam: QuizTeam = {
        id: `team-${Date.now()}`,
        name: `Team ${teamNum}`,
        color: DEFAULT_COLORS[colorIndex],
        score: 0,
      };
      return { ...state, teams: [...state.teams, newTeam] };
    });
  }

  removeTeam(teamId: string): void {
    this.update(state => ({
      ...state,
      teams: state.teams.filter(t => t.id !== teamId),
      categories: state.categories.map(cat => ({
        ...cat,
        questions: cat.questions.map(q =>
          q.answeredBy === teamId ? { ...q, answeredBy: null } : q
        ),
      })),
    }));
  }

  updateTeam(teamId: string, updates: Partial<Pick<QuizTeam, 'name' | 'color'>>): void {
    this.update(state => ({
      ...state,
      teams: state.teams.map(t =>
        t.id === teamId ? { ...t, ...updates } : t
      ),
    }));
  }

  setTeamScore(teamId: string, score: number): void {
    this.update(state => ({
      ...state,
      teams: state.teams.map(t =>
        t.id === teamId ? { ...t, score } : t
      ),
    }));
  }

  adjustTeamScore(teamId: string, delta: number): void {
    this.update(state => ({
      ...state,
      teams: state.teams.map(t =>
        t.id === teamId ? { ...t, score: t.score + delta } : t
      ),
    }));
  }

  // Category management
  addCategory(): void {
    this.update(state => {
      const catNum = state.categories.length + 1;
      const catId = `cat-${Date.now()}`;
      const newCategory: QuizCategory = {
        id: catId,
        name: `Kategorie ${catNum}`,
        questions: createDefaultQuestions(catId),
      };
      return { ...state, categories: [...state.categories, newCategory] };
    });
  }

  removeCategory(categoryId: string): void {
    this.update(state => ({
      ...state,
      categories: state.categories.filter(c => c.id !== categoryId),
      currentQuestion: state.categories
        .find(c => c.id === categoryId)
        ?.questions.some(q => q.id === state.currentQuestion)
        ? null
        : state.currentQuestion,
    }));
  }

  updateCategory(categoryId: string, name: string): void {
    this.update(state => ({
      ...state,
      categories: state.categories.map(c =>
        c.id === categoryId ? { ...c, name } : c
      ),
    }));
  }

  // Question management
  updateQuestion(questionId: string, updates: Partial<Pick<QuizQuestion, 'question' | 'answer' | 'notes'>>): void {
    this.update(state => ({
      ...state,
      categories: state.categories.map(cat => ({
        ...cat,
        questions: cat.questions.map(q =>
          q.id === questionId ? { ...q, ...updates } : q
        ),
      })),
    }));
  }

  selectQuestion(questionId: string | null): void {
    this.update(state => ({
      ...state,
      currentQuestion: questionId,
      showAnswer: false,
    }));
  }

  toggleAnswer(): void {
    this.update(state => ({
      ...state,
      showAnswer: !state.showAnswer,
    }));
  }

  revealQuestion(questionId: string, teamId: string | null): void {
    this.update(state => {
      const question = state.categories
        .flatMap(c => c.questions)
        .find(q => q.id === questionId);

      if (!question) return state;

      // Update score if team answered correctly
      let teams = state.teams;
      if (teamId) {
        teams = state.teams.map(t =>
          t.id === teamId ? { ...t, score: t.score + question.points } : t
        );
      }

      return {
        ...state,
        teams,
        categories: state.categories.map(cat => ({
          ...cat,
          questions: cat.questions.map(q =>
            q.id === questionId ? { ...q, revealed: true, answeredBy: teamId } : q
          ),
        })),
        currentQuestion: null,
        showAnswer: false,
      };
    });
  }

  // Game management
  resetGame(): void {
    this.update(state => ({
      ...state,
      teams: state.teams.map(t => ({ ...t, score: 0 })),
      categories: state.categories.map(cat => ({
        ...cat,
        questions: cat.questions.map(q => ({
          ...q,
          revealed: false,
          answeredBy: null,
        })),
      })),
      currentQuestion: null,
      showAnswer: false,
    }));
  }

  resetAll(): void {
    this.state = createDefaultState();
    this.save();
    this.notify();
  }

  // Import/Export
  exportState(): string {
    return JSON.stringify(this.state, null, 2);
  }

  importState(json: string): boolean {
    try {
      const imported = JSON.parse(json) as QuizState;
      // Basic validation
      if (!imported.categories || !imported.teams) {
        return false;
      }
      this.state = imported;
      this.save();
      this.notify();
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const quizStore = new QuizStore();
