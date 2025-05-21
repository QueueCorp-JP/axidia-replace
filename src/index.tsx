import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Initialize PDF.js for the entire application
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker path to a CDN URL
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Handle service worker errors
const handleServiceWorkerError = (error: Error) => {
  console.error('Service worker error:', error);
  // Remove service worker registration if it's causing issues
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  }
};

// Catch any unhandled promise rejections related to service workers
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && 
      event.reason.message && 
      event.reason.message.includes('Receiving end does not exist')) {
    event.preventDefault();
    handleServiceWorkerError(event.reason);
  }
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 