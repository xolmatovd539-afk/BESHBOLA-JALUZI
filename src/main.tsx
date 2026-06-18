import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// WebSocket va HMR bilan bog'liq zararsiz xatoliklarni brauzer ekraniga chiqarishni va xato darchasini bloklash
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (!reason) return;
    
    const reasonStr = String(reason.message || reason);
    const isWebSocketError = 
      (reason instanceof Event && reason.target instanceof WebSocket) ||
      (reason.target && reason.target.constructor && reason.target.constructor.name === 'WebSocket') ||
      reasonStr.includes('WebSocket') || 
      reasonStr.includes('websocket') || 
      reasonStr.includes('vite') ||
      reasonStr.includes('HMR') ||
      reasonStr.includes('closed without opened');

    if (isWebSocketError) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener('error', (event) => {
    const error = event.error || event;
    const errorMsg = event.message ? String(event.message) : '';
    const isWebSocketError = 
      (error instanceof Event && error.target instanceof WebSocket) ||
      (event.target && event.target.constructor && event.target.constructor.name === 'WebSocket') ||
      errorMsg.includes('WebSocket') || 
      errorMsg.includes('websocket') || 
      errorMsg.includes('vite') ||
      errorMsg.includes('HMR') ||
      errorMsg.includes('closed without opened') ||
      String(error).includes('WebSocket') ||
      String(error).includes('websocket') ||
      String(error).includes('closed without opened');

    if (isWebSocketError) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true); // useCapture = true orqali unbubbled element/websocket xatolarini ham tutamiz
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

