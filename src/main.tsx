import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { DatabaseProvider } from './contexts/DatabaseContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <DatabaseProvider>
      <App />
    </DatabaseProvider>
  </React.StrictMode>,
);
