import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from '@/auth/AuthProvider';
import { App } from '@/App';
import './index.css';
import { firebase } from '@/lib/firebase';

firebase();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);

console.log('[env]', {
  MODE: import.meta.env.MODE,
  DEV: import.meta.env.DEV,
  PROD: import.meta.env.PROD,
  VITE_USE_EMULATORS: import.meta.env.VITE_USE_EMULATORS,
  HOST: location.hostname,
});

console.log(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ((window as any).__FBCFG = {
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    origin: location.origin,
  }),
);
