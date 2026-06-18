import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// WebSocket va HMR bilan bog'liq zararsiz xatoliklarni brauzer ekraniga chiqarishni va xato darchasini bloklash
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    try {
      const reason = event.reason;
      if (!reason) return;
      
      let reasonStr = '';
      try {
        reasonStr = typeof reason === 'string' 
          ? reason 
          : (reason.message || reason.reason || JSON.stringify(reason) || String(reason));
      } catch (e) {
        reasonStr = String(reason);
      }
      
      const s = reasonStr.toLowerCase();
      const isWebSocketError = 
        s.includes('websocket') || 
        s.includes('vite') || 
        s.includes('hmr') || 
        s.includes('ws:') ||
        s.includes('closed') ||
        s.includes('opened') ||
        (reason instanceof Event && reason.target instanceof WebSocket) ||
        (reason.target && reason.target.constructor && reason.target.constructor.name === 'WebSocket') ||
        (reason.target?.constructor?.name === 'WebSocket');

      if (isWebSocketError) {
        event.preventDefault();
        event.stopPropagation();
      }
    } catch (e) {
      // Safe guard
    }
  });

  window.addEventListener('error', (event) => {
    try {
      const error = event.error || event;
      let errorMsg = '';
      try {
        errorMsg = event.message 
          ? String(event.message) 
          : (error.message || error.reason || JSON.stringify(error) || String(error));
      } catch (e) {
        errorMsg = event.message ? String(event.message) : '';
      }

      const s = errorMsg.toLowerCase();
      const isWebSocketError = 
        s.includes('websocket') || 
        s.includes('vite') || 
        s.includes('hmr') || 
        s.includes('ws:') ||
        s.includes('closed') ||
        s.includes('opened') ||
        (error instanceof Event && error.target instanceof WebSocket) ||
        (event.target && event.target.constructor && event.target.constructor.name === 'WebSocket') ||
        (event.target?.constructor?.name === 'WebSocket');

      if (isWebSocketError) {
        event.preventDefault();
        event.stopPropagation();
      }
    } catch (e) {
      // Safe guard
    }
  }, true); // useCapture = true orqali unbubbled element/websocket xatolarini ham tutamiz
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

