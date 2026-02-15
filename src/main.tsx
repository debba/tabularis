// Import polyfills first to make Buffer available globally
import './polyfills';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n/config';
import { DatabaseProvider } from './contexts/DatabaseProvider';
import { SettingsProvider } from './contexts/SettingsProvider';
import { SavedQueriesProvider } from './contexts/SavedQueriesProvider';
import { EditorProvider } from './contexts/EditorProvider';
import { ThemeProvider } from './contexts/ThemeProvider';
import { UpdateProvider } from './contexts/UpdateProvider';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <UpdateProvider>
      <ThemeProvider>
        <SettingsProvider>
          <DatabaseProvider>
            <SavedQueriesProvider>
              <EditorProvider>
                <App />
              </EditorProvider>
            </SavedQueriesProvider>
          </DatabaseProvider>
        </SettingsProvider>
      </ThemeProvider>
    </UpdateProvider>
  </React.StrictMode>,
);
