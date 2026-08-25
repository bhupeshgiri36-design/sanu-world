import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Fix for in-app browsers (Instagram, Facebook, etc.) where 100dvh doesn't
// track the real visible viewport, leaving dead black space at the bottom
// of full-height screens like ChatRoom. We store the real viewport height
// in a CSS variable and keep it updated on resize/orientation change.
function setAppHeight() {
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
}
setAppHeight();
window.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', setAppHeight);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
