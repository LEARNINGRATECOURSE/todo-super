import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { db } from './db/database';
import { seedDefaults } from './repo/seed';
import { useAppStore } from './store/useAppStore';
import { useWorkoutStore } from './store/useWorkoutStore';
import { syncAmbient } from './store/usePomodoroStore';

seedDefaults();
useAppStore.getState().sync();
useWorkoutStore.getState().sync();
syncAmbient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('SW registration failed', err));
  });
}
window.addEventListener('beforeunload', () => db.flush());
