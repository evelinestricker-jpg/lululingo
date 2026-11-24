import { closeSheet } from './ui.js';
import * as home from './screens/home.js';
import * as library from './screens/library.js';
import * as player from './screens/player.js';
import * as addvideo from './screens/addvideo.js';
import * as cards from './screens/cards.js';
import * as chat from './screens/chat.js';
import * as learn from './screens/learn.js';
import * as game from './screens/game.js';
import * as settings from './screens/settings.js';

// Hash-ruter, fx #/play/ep01 eller #/game/particles
const ROUTES = {
  '': { mod: home, tab: 'home' },
  library: { mod: library, tab: 'library' },
  play: { mod: player, tab: 'library', full: true },
  watch: { mod: { render: player.renderVideo }, tab: 'library', full: true },
  'add-video': { mod: addvideo, tab: 'library' },
  cards: { mod: cards, tab: 'cards' },
  chat: { mod: chat, tab: 'chat' },
  learn: { mod: learn, tab: 'learn' },
  game: { mod: game, tab: 'learn', full: true },
  settings: { mod: settings, tab: 'home' }
};

const view = document.getElementById('view');
let cleanup = null;

async function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const r = ROUTES[parts[0]] || ROUTES[''];
  if (typeof cleanup === 'function') { try { cleanup(); } catch (e) {} }
  cleanup = null;
  closeSheet();
  document.querySelectorAll('#tabs a').forEach((a) => {
    const on = a.dataset.tab === r.tab;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.body.classList.toggle('no-tabs', !!r.full);
  view.classList.toggle('full', !!r.full);
  view.innerHTML = '';
  window.scrollTo(0, 0);
  try {
    cleanup = await r.mod.render(view, parts.slice(1));
  } catch (e) {
    console.error(e);
    view.innerHTML = '<div class="err">Noget gik galt her. Prøv at gå tilbage og åbne skærmen igen.</div>';
  }
}

window.addEventListener('hashchange', route);
route();

// Offline-understøttelse (kun når siden hentes over http/https)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
