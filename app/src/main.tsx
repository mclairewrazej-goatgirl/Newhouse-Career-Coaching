import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './styles/tokens.css';
import './styles/app.css';
import { App } from './App';
import { readConnectFromSearch, searchWithoutConnect } from './shared/connect';
import { createSessionStore } from './state/session';
import { browserStore } from './state/storage';

registerSW({ immediate: true });

const kv = browserStore();
const store = createSessionStore(kv);

// A personal app link (?connect=…) links this device to the coach's sheet.
const link = readConnectFromSearch(window.location.search);
if (link.kind === 'address') store.link(link.address);
if (link.kind !== 'none') {
  const { pathname, search, hash } = window.location;
  window.history.replaceState(null, '', pathname + searchWithoutConnect(search) + hash);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={store} kv={kv} demo={import.meta.env.VITE_DEMO === '1'} badLink={link.kind === 'invalid'} />
  </StrictMode>,
);
