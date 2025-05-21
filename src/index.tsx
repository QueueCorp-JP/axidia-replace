import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Initialize PDF.js for the entire application
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker path to a CDN URL
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Disable problematic service workers
const disableServiceWorkers = () => {
  if ('serviceWorker' in navigator) {
    // Unregister all service workers
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const registration of registrations) {
        registration.unregister();
        console.log('Service worker unregistered:', registration.scope);
      }
    }).catch(error => {
      console.error('Error unregistering service workers:', error);
    });
    
    // Prevent future service worker registration attempts
    const originalRegister = navigator.serviceWorker.register;
    navigator.serviceWorker.register = function() {
      console.warn('Service worker registration prevented');
      return Promise.reject(new Error('Service worker registration prevented'));
    };
  }
};

// Execute service worker cleanup
disableServiceWorkers();

// Handle service worker errors
window.addEventListener('error', (event) => {
  if (event.message && (
    event.message.includes('service-worker') || 
    event.message.includes('Receiving end does not exist')
  )) {
    event.preventDefault();
    console.warn('Service worker error suppressed:', event.message);
  }
});

// Catch any unhandled promise rejections related to service workers
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && 
      event.reason.message && 
      (event.reason.message.includes('Receiving end does not exist') ||
       event.reason.message.includes('service-worker'))) {
    event.preventDefault();
    console.warn('Service worker promise rejection suppressed:', event.reason.message);
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