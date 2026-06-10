import styles from './QuizTable.module.css';
import type {Quiz} from '../hooks/useQuizHistory.ts';

interface Props {
  quizzes: Quiz[];
  onDelete?: (id: string) => void;
}

export default function QuizTable({quizzes, onDelete}: Props) {
  if (quizzes.length === 0) {
    return <div className={styles.empty}>クイズがありません</div>;
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>問題文</th>
            <th>答え</th>
            <th>文字数</th>
            <th>ジャンル</th>
            <th>モデル</th>
            {onDelete && <th></th>}
          </tr>
        </thead>
        <tbody>
          {quizzes.map((q) => (
            <tr key={q._id} className={q.charCount === 30 ? styles.exact : styles.inexact}>
              <td className={styles.question}>{q.question}</td>
              <td>{q.answer}</td>
              <td className={styles.count}>
                <span className={q.charCount === 30 ? styles.ok : styles.ng}>{q.charCount}</span>
              </td>
              <td>{q.majorGenre} / {q.minorGenre}</td>
              <td className={styles.model}>{q.modelName}</td>
              {onDelete && (
                <td>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => onDelete(q._id)}
                    title="削除"
                  >
                    ×
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
