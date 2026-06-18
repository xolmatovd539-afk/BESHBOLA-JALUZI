import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// WebSocket va HMR bilan bog'liq zararsiz xatoliklarni brauzer ekraniga chiqarishni va xato darchasini bloklash
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = event.reason ? String(event.reason.message || event.reason) : '';
    if (
      reasonStr.includes('WebSocket') || 
      reasonStr.includes('websocket') || 
      reasonStr.includes('vite') ||
      reasonStr.includes('HMR')
    ) {
      event.preventDefault();
    }
  });

  window.addEventListener('error', (event) => {
    const errorMsg = event.message ? String(event.message) : '';
    if (
      errorMsg.includes('WebSocket') || 
      errorMsg.includes('websocket') || 
      errorMsg.includes('vite') ||
      errorMsg.includes('HMR')
    ) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

