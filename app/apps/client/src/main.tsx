import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import './index.css';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8787';

const container = document.getElementById('root');
if (!container) throw new Error('The application root element is missing.');

createRoot(container).render(
  <React.StrictMode>
    <App apiBaseUrl={apiBaseUrl} />
  </React.StrictMode>,
);
