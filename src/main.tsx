import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { DatabaseProvider } from './contexts/DatabaseContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { SavedQueriesProvider } from './contexts/SavedQueriesContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <SettingsProvider>
      <DatabaseProvider>
        <SavedQueriesProvider>
          <App />
        </SavedQueriesProvider>
      </DatabaseProvider>
    </SettingsProvider>
  </React.StrictMode>,
);
