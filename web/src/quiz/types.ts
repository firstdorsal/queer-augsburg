// Quiz Show Types

export interface QuizQuestion {
  id: string;
  points: number;
  question: string;
  answer: string;
  notes: string; // for links, hints, etc. (only visible on control side)
  revealed: boolean;
  answeredBy: string | null; // team id
}

export interface QuizCategory {
  id: string;
  name: string;
  questions: QuizQuestion[];
}

export interface QuizTeam {
  id: string;
  name: string;
  color: string;
  score: number;
}

export interface QuizState {
  categories: QuizCategory[];
  teams: QuizTeam[];
  currentQuestion: string | null; // question id
  showAnswer: boolean;
}

export const POINT_VALUES = [100, 200, 300, 400, 500] as const;

export const DEFAULT_COLORS = [
  '#e63946', // Red
  '#457b9d', // Blue
  '#2a9d8f', // Teal
  '#e9c46a', // Yellow
  '#f4a261', // Orange
  '#9b5de5', // Purple
  '#00f5d4', // Cyan
  '#ff6b6b', // Coral
] as const;

export const DEFAULT_CATEGORIES: QuizCategory[] = [
  { id: 'cat-1', name: 'Kategorie 1', questions: [] },
  { id: 'cat-2', name: 'Kategorie 2', questions: [] },
  { id: 'cat-3', name: 'Kategorie 3', questions: [] },
  { id: 'cat-4', name: 'Kategorie 4', questions: [] },
  { id: 'cat-5', name: 'Kategorie 5', questions: [] },
  { id: 'cat-6', name: 'Kategorie 6', questions: [] },
];

export function createDefaultQuestions(categoryId: string): QuizQuestion[] {
  return POINT_VALUES.map((points, index) => ({
    id: `${categoryId}-q${index}`,
    points,
    question: '',
    answer: '',
    notes: '',
    revealed: false,
    answeredBy: null,
  }));
}

export function createDefaultState(): QuizState {
  const categories = DEFAULT_CATEGORIES.map(cat => ({
    ...cat,
    questions: createDefaultQuestions(cat.id),
  }));

  return {
    categories,
    teams: [
      { id: 'team-1', name: 'Team 1', color: DEFAULT_COLORS[0], score: 0 },
      { id: 'team-2', name: 'Team 2', color: DEFAULT_COLORS[1], score: 0 },
    ],
    currentQuestion: null,
    showAnswer: false,
  };
}
