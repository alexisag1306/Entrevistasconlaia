import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles/00-tailwind.css';
import './styles/01-foundation.css';
import './styles/02-screens-and-components.css';
import './styles/03-neutral-theme.css';
import './styles/04-refinements.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
