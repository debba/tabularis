import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { DatabaseProvider } from './contexts/DatabaseContext';
import { SettingsProvider } from './contexts/SettingsContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <SettingsProvider>
      <DatabaseProvider>
        <App />
      </DatabaseProvider>
    </SettingsProvider>
  </React.StrictMode>,
);
