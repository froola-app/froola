import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { cleanupOAuthError } from './oauthCleanup';

// Handle a cancelled/failed sign-in (lands on the app root with ?error=...)
// before the router reads the URL, so the popup closes and no error params
// flash in the address bar.
cleanupOAuthError();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
