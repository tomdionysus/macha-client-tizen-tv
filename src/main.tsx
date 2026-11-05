import { createRoot } from 'react-dom/client';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import './styles.css';
import { installAbortControllerPolyfill } from './platform/AbortControllerPolyfill';
import { App } from './App';

// Chromium 47 has no `AbortController`, and core's bounded requests need
// one: this must run before anything fetches.
installAbortControllerPolyfill(window);

/**
 * A television has no console. A crash is written over the page in words,
 * so the failure can be read from the sofa.
 */
function showFatal(error: unknown): void {
  const root = document.getElementById('root') ?? document.body;
  const message = document.createElement('pre');
  message.style.background = '#180000';
  message.style.color = '#ffffff';
  message.style.fontFamily = 'monospace';
  message.style.fontSize = '24px';
  message.style.margin = '0';
  message.style.padding = '32px';
  message.style.whiteSpace = 'pre-wrap';
  const described = error instanceof Error ? error.stack || error.message : String(error);
  message.textContent = `Macha runtime failure\n\n${described}\n\n${navigator.userAgent}`;
  while (root.firstChild) root.removeChild(root.firstChild);
  root.appendChild(message);
}

window.addEventListener('error', (event) => showFatal(event.error ?? event.message));
window.addEventListener('unhandledrejection', (event) => showFatal(event.reason));

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element');
createRoot(rootElement).render(<App />);
