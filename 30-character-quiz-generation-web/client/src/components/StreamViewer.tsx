import {useEffect, useRef} from 'react';
import styles from './StreamViewer.module.css';

interface Props {
  text: string;
  status?: string;
}

export default function StreamViewer({text, status}: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [text]);

  if (!text && !status) return null;

  return (
    <div className={styles.viewer}>
      {status && <div className={styles.status}>{status}</div>}
      <pre className={styles.content}>{text}</pre>
      <div ref={endRef} />
    </div>
  );
}
