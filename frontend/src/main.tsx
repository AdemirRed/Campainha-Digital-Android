import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { bootstrapDoorbellFromUrl } from './utils/doorbell';
import { startAutoUpdate } from './utils/autoUpdate';

bootstrapDoorbellFromUrl();
startAutoUpdate();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
