import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './store/themeStore'; // keeps the theme in sync with the OS and the saved preference
import './index.css';
import { startServiceWorker } from './lib/push';

startServiceWorker(); // notifications and "Install app"

// Error reporting, only when a DSN is configured (loaded on its own, after the app)
if (import.meta.env.VITE_SENTRY_DSN) {
  import('@sentry/react').then((Sentry) => Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: import.meta.env.MODE }));
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
