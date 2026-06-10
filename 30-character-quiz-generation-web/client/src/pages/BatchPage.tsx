import BatchControl from '../components/BatchControl.tsx';
import styles from './BatchPage.module.css';

export default function BatchPage() {
  return (
    <div className={styles.page}>
      <h1>バッチ生成</h1>
      <BatchControl />
    </div>
  );
}
