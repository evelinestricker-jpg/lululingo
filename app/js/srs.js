// Spaced repetition: kort kommer igen lige før du ville glemme dem.
import { db, save, activity } from './store.js';

const MIN = 60e3, DAY = 864e5;

export function addCard(fields) {
  if (db.cards[fields.id]) return false;
  db.cards[fields.id] = Object.assign({ due: Date.now(), interval: 0, ease: 2.5, reps: 0, lapses: 0, added: Date.now() }, fields);
  activity({ newWords: 1, xp: 2 });
  return true;
}

export function removeCard(id) {
  delete db.cards[id];
  save();
}

export function hasCard(id) { return !!db.cards[id]; }

// rating: 0 = Igen, 1 = Svært, 2 = Godt, 3 = Let
export function nextInterval(card, rating) {
  const learning = card.reps === 0 || card.interval < DAY;
  if (learning) return [MIN, 6 * MIN, DAY, 4 * DAY][rating];
  const ease = card.ease;
  if (rating === 0) return 10 * MIN;
  if (rating === 1) return Math.max(DAY, card.interval * 1.2);
  if (rating === 2) return Math.max(DAY, card.interval * ease);
  return Math.max(2 * DAY, card.interval * ease * 1.3);
}

export function review(card, rating) {
  const iv = nextInterval(card, rating);
  if (card.reps > 0 && card.interval >= DAY) {
    if (rating === 0) { card.ease -= 0.2; card.lapses += 1; }
    if (rating === 1) card.ease -= 0.15;
    if (rating === 3) card.ease += 0.15;
    card.ease = Math.min(3, Math.max(1.3, card.ease));
  }
  card.interval = iv;
  card.reps += 1;
  card.due = Date.now() + iv;
  activity({ reviews: 1, xp: rating === 0 ? 1 : 3 });
}

export function fmtInterval(ms) {
  if (ms < 2 * MIN) return '< 1 min';
  if (ms < 60 * MIN) return Math.round(ms / MIN) + ' min';
  if (ms < DAY) return Math.round(ms / (60 * MIN)) + ' t';
  const d = Math.round(ms / DAY);
  if (d < 31) return d + (d === 1 ? ' dag' : ' dage');
  const m = Math.round(d / 30);
  return m + (m === 1 ? ' md.' : ' mdr.');
}

export function cardsIn(deck) {
  return Object.values(db.cards).filter((c) => !deck || c.deck === deck);
}

export function dueCards(deck) {
  const now = Date.now();
  return cardsIn(deck).filter((c) => c.due <= now).sort((a, b) => a.due - b.due);
}

export function learnedCount(deck) {
  return cardsIn(deck).filter((c) => c.interval >= DAY).length;
}
