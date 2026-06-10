import styles from './ExportButton.module.css';

interface Props {
  majorGenre?: string;
  minorGenre?: string;
  onlyExact?: boolean;
}

export default function ExportButton({majorGenre, minorGenre, onlyExact}: Props) {
  const handleExport = () => {
    const params = new URLSearchParams();
    if (majorGenre) params.set('majorGenre', majorGenre);
    if (minorGenre) params.set('minorGenre', minorGenre);
    if (onlyExact) params.set('onlyExact', 'true');
    window.location.href = `/api/export/tsv?${params}`;
  };

  return (
    <button className={styles.btn} onClick={handleExport}>
      TSVエクスポート
    </button>
  );
}
