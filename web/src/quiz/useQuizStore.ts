// React hook for quiz store

import { useState, useEffect } from 'react';
import { QuizState } from './types';
import { quizStore } from './store';

export function useQuizStore(): QuizState {
  const [state, setState] = useState<QuizState>(() => quizStore.getState());

  useEffect(() => {
    return quizStore.subscribe(setState);
  }, []);

  return state;
}

export { quizStore };
