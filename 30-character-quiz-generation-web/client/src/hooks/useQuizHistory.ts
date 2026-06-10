import {useState, useCallback} from 'react';

export interface Quiz {
  _id: string;
  question: string;
  answer: string;
  majorGenre: string;
  minorGenre: string;
  answerFormat: string;
  llmBackend: string;
  modelName: string;
  charCount: number;
  createdAt: string;
}

interface FetchParams {
  page?: number;
  limit?: number;
  majorGenre?: string;
  minorGenre?: string;
}

export function useQuizHistory() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (params: FetchParams = {}) => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.majorGenre) query.set('majorGenre', params.majorGenre);
      if (params.minorGenre) query.set('minorGenre', params.minorGenre);

      const response = await window.fetch(`/api/quizzes?${query}`);
      const data = await response.json() as {quizzes: Quiz[]; total: number};
      setQuizzes(data.quizzes);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteQuiz = useCallback(async (id: string) => {
    await window.fetch(`/api/quizzes/${id}`, {method: 'DELETE'});
    setQuizzes((prev) => prev.filter((q) => q._id !== id));
    setTotal((prev) => prev - 1);
  }, []);

  return {quizzes, total, loading, fetch, deleteQuiz};
}
