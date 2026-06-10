import {useState, useEffect} from 'react';
import styles from './GenForm.module.css';

export interface GenFormValues {
  majorGenre: string;
  minorGenre: string;
  answerFormat: string;
  llmBackend: 'ollama' | 'claude';
  modelName: string;
  useWikipedia: boolean;
  wikiTitle: string;
}

interface Props {
  onSubmit: (values: GenFormValues) => void;
  loading: boolean;
  onAbort?: () => void;
}

export default function GenForm({onSubmit, loading, onAbort}: Props) {
  const [values, setValues] = useState<GenFormValues>({
    majorGenre: '',
    minorGenre: '',
    answerFormat: '人名',
    llmBackend: 'claude',
    modelName: 'claude-opus-4-8',
    useWikipedia: false,
    wikiTitle: '',
  });
  const [models, setModels] = useState<string[]>([]);
  const [modelsWarning, setModelsWarning] = useState('');

  useEffect(() => {
    setModelsWarning('');
    fetch(`/api/generate/models?backend=${values.llmBackend}`)
      .then((r) => r.json())
      .then((data: {models?: string[]; warning?: string}) => {
        const list = data.models ?? [];
        setModels(list);
        if (data.warning) setModelsWarning(data.warning);
        if (list.length > 0 && !list.includes(values.modelName)) {
          setValues((v) => ({...v, modelName: list[0]}));
        }
      })
      .catch(() => {});
  }, [values.llmBackend]);

  const set = (key: keyof GenFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setValues((v) => ({...v, [key]: value}));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.row}>
        <label>
          大ジャンル
          <input value={values.majorGenre} onChange={set('majorGenre')} placeholder="例: 芸能" required />
        </label>
        <label>
          小ジャンル
          <input value={values.minorGenre} onChange={set('minorGenre')} placeholder="例: 映画" required />
        </label>
        <label>
          答えの形式
          <input value={values.answerFormat} onChange={set('answerFormat')} placeholder="例: 人名" required />
        </label>
      </div>

      <div className={styles.row}>
        <label>
          LLMバックエンド
          <select value={values.llmBackend} onChange={set('llmBackend')}>
            <option value="claude">Claude API</option>
            <option value="ollama">Ollama（ローカル）</option>
          </select>
        </label>
        <label>
          モデル
          {models.length > 0 ? (
            <select value={values.modelName} onChange={set('modelName')}>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : (
            <input value={values.modelName} onChange={set('modelName')} placeholder="モデル名を入力" required />
          )}
        </label>
      </div>

      {modelsWarning && (
        <div className={styles.warning}>
          Ollamaに接続できません: {modelsWarning}
        </div>
      )}

      <div className={styles.row}>
        <label className={styles.checkLabel}>
          <input type="checkbox" checked={values.useWikipedia} onChange={set('useWikipedia')} />
          Wikipediaグラウンディングを使用
        </label>
        {values.useWikipedia && (
          <label>
            Wikipedia記事タイトル（省略時は小ジャンル名）
            <input value={values.wikiTitle} onChange={set('wikiTitle')} placeholder="例: 映画" />
          </label>
        )}
      </div>

      <div className={styles.actions}>
        {loading ? (
          <button type="button" onClick={onAbort} className={styles.abortBtn}>
            中断
          </button>
        ) : (
          <button type="submit" className={styles.submitBtn}>
            生成開始
          </button>
        )}
      </div>
    </form>
  );
}
