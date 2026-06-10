import {BrowserRouter, Routes, Route, Link, useLocation} from 'react-router-dom';
import GeneratePage from './pages/GeneratePage.tsx';
import HistoryPage from './pages/HistoryPage.tsx';
import BatchPage from './pages/BatchPage.tsx';
import styles from './App.module.css';

function NavBar() {
  const location = useLocation();
  return (
    <nav className={styles.nav}>
      <span className={styles.title}>30文字クイズジェネレーター</span>
      <div className={styles.links}>
        <Link className={location.pathname === '/' ? styles.active : ''} to="/">生成</Link>
        <Link className={location.pathname === '/history' ? styles.active : ''} to="/history">履歴</Link>
        <Link className={location.pathname === '/batch' ? styles.active : ''} to="/batch">バッチ</Link>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<GeneratePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/batch" element={<BatchPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
