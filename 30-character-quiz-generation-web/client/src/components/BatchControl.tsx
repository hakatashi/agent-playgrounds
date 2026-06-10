import {useState, useEffect} from 'react';
import styles from './BatchControl.module.css';

interface BatchJob {
  _id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  majorGenre: string;
  answerFormat: string;
  minorGenres: string[];
  llmBackend: string;
  modelName: string;
  totalCount: number;
  completedCount: number;
  currentIndex: number;
  createdAt: string;
}

interface BatchFormValues {
  majorGenre: string;
  answerFormat: string;
  minorGenresText: string;
  llmBackend: 'ollama' | 'claude';
  modelName: string;
  useWikipedia: boolean;
}

export default function BatchControl() {
  const [form, setForm] = useState<BatchFormValues>({
    majorGenre: '',
    answerFormat: '人名',
    minorGenresText: '',
    llmBackend: 'claude',
    modelName: 'claude-opus-4-8',
    useWikipedia: false,
  });
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/generate/models?backend=${form.llmBackend}`)
      .then((r) => r.json())
      .then((data: {models?: string[]}) => {
        setModels(data.models ?? []);
      })
      .catch(() => {});
  }, [form.llmBackend]);

  const loadJobs = async () => {
    const response = await fetch('/api/batch');
    const data = await response.json() as {jobs: BatchJob[]};
    setJobs(data.jobs);
  };

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 2000);
    return () => clearInterval(interval);
  }, []);

  const set = (key: keyof BatchFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm((v) => ({...v, [key]: value}));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const minorGenres = form.minorGenresText.split('\n').map((s) => s.trim()).filter(Boolean);
      if (minorGenres.length === 0) {
        alert('小ジャンルを入力してください');
        return;
      }

      await fetch('/api/batch', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          majorGenre: form.majorGenre,
          answerFormat: form.answerFormat,
          minorGenres,
          llmBackend: form.llmBackend,
          modelName: form.modelName,
          useWikipedia: form.useWikipedia,
        }),
      });

      await loadJobs();
    } finally {
      setSubmitting(false);
    }
  };

  const handleAbort = async (jobId: string) => {
    await fetch(`/api/batch/${jobId}`, {method: 'DELETE'});
    await loadJobs();
  };

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <h2>バッチ生成設定</h2>
        <div className={styles.row}>
          <label>
            大ジャンル
            <input value={form.majorGenre} onChange={set('majorGenre')} placeholder="例: 芸能" required />
          </label>
          <label>
            答えの形式
            <input value={form.answerFormat} onChange={set('answerFormat')} placeholder="例: 人名" required />
          </label>
        </div>

        <div className={styles.row}>
          <label>
            LLMバックエンド
            <select value={form.llmBackend} onChange={set('llmBackend')}>
              <option value="claude">Claude API</option>
              <option value="ollama">Ollama（ローカル）</option>
            </select>
          </label>
          <label>
            モデル
            {models.length > 0 ? (
              <select value={form.modelName} onChange={set('modelName')}>
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input value={form.modelName} onChange={set('modelName')} placeholder="モデル名を入力" required />
            )}
          </label>
        </div>

        <label className={styles.checkLabel}>
          <input type="checkbox" checked={form.useWikipedia} onChange={set('useWikipedia')} />
          Wikipediaグラウンディング（小ジャンル名で検索）
        </label>

        <label>
          小ジャンル一覧（1行1ジャンル）
          <textarea
            value={form.minorGenresText}
            onChange={set('minorGenresText')}
            rows={6}
            placeholder={'映画\n音楽\nスポーツ'}
            required
          />
        </label>

        <button type="submit" className={styles.submitBtn} disabled={submitting}>
          {submitting ? '送信中...' : 'バッチ生成開始'}
        </button>
      </form>

      <div className={styles.jobs}>
        <h2>ジョブ一覧</h2>
        {jobs.length === 0 ? (
          <div className={styles.empty}>ジョブがありません</div>
        ) : (
          <div className={styles.jobList}>
            {jobs.map((job) => (
              <div key={job._id} className={`${styles.job} ${styles[job.status]}`}>
                <div className={styles.jobHeader}>
                  <span className={styles.jobTitle}>{job.majorGenre} / {job.answerFormat}</span>
                  <span className={`${styles.badge} ${styles[`badge_${job.status}`]}`}>
                    {job.status === 'pending' ? '待機中' : job.status === 'running' ? '実行中' : job.status === 'completed' ? '完了' : '失敗'}
                  </span>
                </div>
                <div className={styles.progress}>
                  <div
                    className={styles.bar}
                    style={{width: `${job.totalCount > 0 ? (job.completedCount / job.totalCount) * 100 : 0}%`}}
                  />
                </div>
                <div className={styles.jobMeta}>
                  {job.completedCount}/{job.totalCount}件完了
                  {job.status === 'running' && ` — 現在: ${job.minorGenres[job.currentIndex] ?? ''}`}
                </div>
                {(job.status === 'running' || job.status === 'pending') && (
                  <button className={styles.abortBtn} onClick={() => handleAbort(job._id)}>中断</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
