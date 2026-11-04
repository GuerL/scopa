import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Vite removes this branch and its dynamic import from every production build.
if (import.meta.env.DEV && import.meta.env.MODE === 'screenshots' && new URLSearchParams(location.search).has('screenshot')) {
  void import('./demo/ScreenshotDemo').then(({ mountScreenshotDemo }) => mountScreenshotDemo());
} else {
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
