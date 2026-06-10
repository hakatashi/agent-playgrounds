import {useState} from 'react';
import GenForm, {type GenFormValues} from '../components/GenForm.tsx';
import StreamViewer from '../components/StreamViewer.tsx';
import QuizTable from '../components/QuizTable.tsx';
import {useSSE} from '../hooks/useSSE.ts';
import type {Quiz} from '../hooks/useQuizHistory.ts';
import styles from './GeneratePage.module.css';

interface GeneratedQuiz {
  id: string;
  question: string;
  answer: string;
  charCount: number;
}

export default function GeneratePage() {
  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [generatedQuizzes, setGeneratedQuizzes] = useState<Quiz[]>([]);
  const [error, setError] = useState('');
  const {start, abort} = useSSE();

  const handleSubmit = async (values: GenFormValues) => {
    setLoading(true);
    setStreamText('');
    setStatusMsg('');
    setGeneratedQuizzes([]);
    setError('');

    try {
      await start('/api/generate', values, {
        onChunk: (content) => setStreamText((prev) => prev + content),
        onStatus: (message) => setStatusMsg(message),
        onResult: (data) => {
          const result = data as {quizzes: GeneratedQuiz[]};
          const quizzes: Quiz[] = result.quizzes.map((q) => ({
            _id: q.id,
            question: q.question,
            answer: q.answer,
            charCount: q.charCount,
            majorGenre: values.majorGenre,
            minorGenre: values.minorGenre,
            answerFormat: values.answerFormat,
            llmBackend: values.llmBackend,
            modelName: values.modelName,
            createdAt: new Date().toISOString(),
          }));
          setGeneratedQuizzes(quizzes);
        },
        onError: (err) => setError(err),
        onDone: () => setLoading(false),
      });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAbort = () => {
    abort();
    setLoading(false);
  };

  return (
    <div className={styles.page}>
      <h1>クイズ生成</h1>

      <GenForm onSubmit={handleSubmit} loading={loading} onAbort={handleAbort} />

      {(streamText || statusMsg) && (
        <div className={styles.section}>
          <h2>LLM出力</h2>
          <StreamViewer text={streamText} status={statusMsg} />
        </div>
      )}

      {error && (
        <div className={styles.error}>エラー: {error}</div>
      )}

      {generatedQuizzes.length > 0 && (
        <div className={styles.section}>
          <h2>生成結果 ({generatedQuizzes.length}件)</h2>
          <QuizTable quizzes={generatedQuizzes} />
        </div>
      )}
    </div>
  );
}
