import {useState, useEffect} from 'react';
import QuizTable from '../components/QuizTable.tsx';
import ExportButton from '../components/ExportButton.tsx';
import {useQuizHistory} from '../hooks/useQuizHistory.ts';
import styles from './HistoryPage.module.css';

const PAGE_SIZE = 30;

export default function HistoryPage() {
  const {quizzes, total, loading, fetch, deleteQuiz} = useQuizHistory();
  const [page, setPage] = useState(1);
  const [majorGenre, setMajorGenre] = useState('');
  const [minorGenre, setMinorGenre] = useState('');
  const [onlyExact, setOnlyExact] = useState(false);

  useEffect(() => {
    fetch({page, limit: PAGE_SIZE, majorGenre: majorGenre || undefined, minorGenre: minorGenre || undefined});
  }, [page, majorGenre, minorGenre]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const filteredQuizzes = onlyExact ? quizzes.filter((q) => q.charCount === 30) : quizzes;

  return (
    <div className={styles.page}>
      <h1>履歴</h1>

      <div className={styles.filters}>
        <label>
          大ジャンル
          <input value={majorGenre} onChange={(e) => { setMajorGenre(e.target.value); setPage(1); }} placeholder="絞り込み" />
        </label>
        <label>
          小ジャンル
          <input value={minorGenre} onChange={(e) => { setMinorGenre(e.target.value); setPage(1); }} placeholder="絞り込み" />
        </label>
        <label className={styles.checkLabel}>
          <input type="checkbox" checked={onlyExact} onChange={(e) => setOnlyExact(e.target.checked)} />
          30文字のみ表示
        </label>
        <ExportButton majorGenre={majorGenre || undefined} minorGenre={minorGenre || undefined} onlyExact={onlyExact} />
      </div>

      {loading ? (
        <div className={styles.loading}>読み込み中...</div>
      ) : (
        <>
          <div className={styles.meta}>全{total}件 / ページ {page}/{totalPages || 1}</div>
          <QuizTable quizzes={filteredQuizzes} onDelete={deleteQuiz} />
          <div className={styles.pagination}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>前</button>
            <span>{page} / {totalPages || 1}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>次</button>
          </div>
        </>
      )}
    </div>
  );
}
