// Learning engine: "Test yourself" quiz, Leitner spaced repetition, Practice hub, dashboard study path.
// Loaded after app.js and uses its globals (NAV, PAGE_KEY, MASTERY_PREFIX, cardKey, questionText,
// markCardMastered, toggleMastery). Never uses innerHTML: answers are shown as cloned DOM nodes.

// ─── Spaced repetition (Leitner, 5 boxes) ──────────────────────────────────
const SRS_KEY = 'interview-srs';
const SRS_DAYS = [1, 3, 7, 14, 30];
const MOCK_SIZE = 20;

function dayString(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
}

function loadSrs() { return readJson(SRS_KEY, {}); }

function isDue(entry) { return !!entry && entry.due <= dayString(); }

// "Got it" moves the card one box up (a new card starts in box 0, due tomorrow);
// "Need practice" puts it back in box 0, due today.
function rateCard(key, got) {
  const srs = loadSrs();
  const prev = srs[key];
  const box = got && prev ? Math.min(prev.box + 1, SRS_DAYS.length - 1) : 0;
  srs[key] = { box, due: dayString(got ? SRS_DAYS[box] : 0), last: got ? 'got' : 'again' };
  localStorage.setItem(SRS_KEY, JSON.stringify(srs));
  setMastered(key, got);
}

function setMastered(key, on) {
  const page = key.split(':')[0];
  const card = page === PAGE_KEY && document.querySelector('.qa-card[data-card-key="' + key + '"]');
  if (card) {
    if (on) markCardMastered(card);
    else if (card.classList.contains('mastered')) toggleMastery(card);
    return;
  }
  const set = new Set(readJson(MASTERY_PREFIX + page, []));
  if (on) set.add(key); else set.delete(key);
  localStorage.setItem(MASTERY_PREFIX + page, JSON.stringify([...set]));
}

// ─── Deck helpers ──────────────────────────────────────────────────────────
function pageOf(href) { return href.replace('.html', ''); }

function topicLabel(page) {
  const nav = NAV.find(n => pageOf(n.href) === page);
  return nav ? nav.label : page;
}

function deckItem(card, page) {
  return {
    key: card.dataset.cardKey || cardKey(card, page),
    page,
    question: questionText(card),
    difficulty: (card.querySelector('.qa-difficulty')?.textContent || '').trim(),
    answer: card.querySelector('.qa-answer'),
  };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Due and never-seen cards first, the rest after; each group shuffled.
function pageDeck() {
  const srs = loadSrs();
  const items = [...document.querySelectorAll('.qa-card')].map(c => deckItem(c, PAGE_KEY));
  const first = items.filter(i => !srs[i.key] || isDue(srs[i.key]));
  return shuffle(first).concat(shuffle(items.filter(i => !first.includes(i))));
}

// One card per topic per round, so 20 questions span as many topics as possible.
function mockDeck(items) {
  const byTopic = {};
  shuffle(items).forEach(i => (byTopic[i.page] = byTopic[i.page] || []).push(i));
  const queues = shuffle(Object.values(byTopic));
  const deck = [];
  while (deck.length < MOCK_SIZE && queues.some(q => q.length)) {
    queues.forEach(q => { if (q.length && deck.length < MOCK_SIZE) deck.push(q.pop()); });
  }
  return deck;
}

// ─── DOM helper ────────────────────────────────────────────────────────────
function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

function iconButton(className, icon, label, onClick) {
  const b = el('button', className);
  b.type = 'button';
  b.appendChild(el('i', icon));
  b.appendChild(document.createTextNode(' ' + label));
  b.addEventListener('click', onClick);
  return b;
}

// ─── Quiz modal ────────────────────────────────────────────────────────────
const quiz = { deck: [], idx: 0, score: { got: 0, again: 0, skip: 0 }, revealed: false, onEnd: null, overlay: null, body: null };

function buildOverlay() {
  const overlay = el('div', 'quiz-overlay');
  const modal = el('div', 'quiz-modal');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Test yourself');
  const close = el('button', 'quiz-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  close.appendChild(el('i', 'fa-solid fa-xmark'));
  close.addEventListener('click', closeQuiz);
  quiz.body = el('div', 'quiz-body');
  modal.append(close, quiz.body);
  overlay.appendChild(modal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeQuiz(); });
  document.body.appendChild(overlay);
  document.addEventListener('keydown', quizKeys);
  return overlay;
}

function startQuiz(deck, onEnd) {
  if (!deck.length) return;
  quiz.overlay = quiz.overlay || buildOverlay();
  Object.assign(quiz, { deck, idx: 0, score: { got: 0, again: 0, skip: 0 }, onEnd: onEnd || null });
  quiz.overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  renderQuestion();
}

function closeQuiz() {
  if (!quiz.overlay) return;
  quiz.overlay.classList.remove('active');
  document.body.style.overflow = '';
  if (quiz.onEnd) quiz.onEnd();
}

function quizKeys(e) {
  if (!quiz.overlay?.classList.contains('active') || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'Escape') closeQuiz();
  else if (quiz.idx >= quiz.deck.length) return;
  else if (e.key === ' ' && !quiz.revealed) { e.preventDefault(); reveal(); }
  else if (e.key === '1' && quiz.revealed) answer(true);
  else if (e.key === '2' && quiz.revealed) answer(false);
}

function quizMeta(item) {
  const meta = el('div', 'quiz-meta');
  meta.appendChild(el('span', 'quiz-count', 'Question ' + (quiz.idx + 1) + ' of ' + quiz.deck.length));
  if (item.page !== PAGE_KEY) meta.appendChild(el('span', 'quiz-topic', topicLabel(item.page)));
  if (item.difficulty) meta.appendChild(el('span', 'quiz-diff-badge ' + item.difficulty.toLowerCase(), item.difficulty));
  return meta;
}

function answerBox(item) {
  const box = el('div', 'quiz-answer-box');
  if (!item.answer) return box;
  const clone = item.answer.cloneNode(true);
  clone.classList.add('quiz-answer');
  clone.querySelectorAll('.copy-btn, .deep-dive').forEach(n => n.remove());
  box.appendChild(clone);
  return box;
}

function renderQuestion() {
  if (quiz.idx >= quiz.deck.length) { renderScore(); return; }
  const item = quiz.deck[quiz.idx];
  quiz.revealed = false;
  const bar = el('div', 'quiz-progress-bar');
  const fill = el('div', 'quiz-progress-fill');
  fill.style.width = Math.round(quiz.idx / quiz.deck.length * 100) + '%';
  bar.appendChild(fill);
  const actions = el('div', 'quiz-actions');
  actions.append(
    iconButton('quiz-btn reveal', 'fa-solid fa-eye', 'Show answer', reveal),
    iconButton('quiz-btn skip', 'fa-solid fa-forward', 'Skip', () => { quiz.score.skip++; next(); }));
  const hint = el('p', 'quiz-hint', 'Say your answer out loud first, then reveal. Keys: Space = show, 1 = got it, 2 = need practice.');
  quiz.body.replaceChildren(bar, quizMeta(item), el('div', 'quiz-question', item.question), answerBox(item), actions, hint);
}

function reveal() {
  quiz.revealed = true;
  quiz.body.querySelector('.quiz-answer-box').classList.add('visible');
  quiz.body.querySelector('.quiz-actions').replaceChildren(
    iconButton('quiz-btn got-it', 'fa-solid fa-check', 'Got it', () => answer(true)),
    iconButton('quiz-btn hard-btn', 'fa-solid fa-rotate-left', 'Need practice', () => answer(false)));
}

function answer(got) {
  rateCard(quiz.deck[quiz.idx].key, got);
  quiz.score[got ? 'got' : 'again']++;
  next();
}

function next() { quiz.idx++; renderQuestion(); }

function scoreItem(num, cls, label) {
  const item = el('div', 'quiz-score-item');
  item.append(el('div', 'quiz-score-num ' + cls, String(num)), el('div', 'quiz-score-label', label));
  return item;
}

function renderScore() {
  const { got, again, skip } = quiz.score;
  const panel = el('div', 'quiz-score-panel');
  const row = el('div', 'quiz-score-row');
  row.append(scoreItem(got, 'green', 'Got it'), scoreItem(again, 'red', 'Need practice'), scoreItem(skip, 'grey', 'Skipped'));
  const actions = el('div', 'quiz-actions quiz-actions-center');
  actions.append(
    iconButton('quiz-btn primary', 'fa-solid fa-rotate-right', 'Go again', () => startQuiz(shuffle(quiz.deck), quiz.onEnd)),
    iconButton('quiz-btn skip', 'fa-solid fa-xmark', 'Close', closeQuiz));
  panel.append(el('h3', '', 'Session done'),
    el('p', '', 'Cards you got are scheduled for later; cards that need practice come back today.'), row, actions);
  quiz.body.replaceChildren(panel);
}

// ─── Per-page "Test yourself" button ───────────────────────────────────────
function initQuizButton() {
  if (!document.querySelector('.content .qa-card')) return;
  const btn = iconButton('quiz-fab', 'fa-solid fa-graduation-cap', 'Test yourself', () => startQuiz(pageDeck()));
  btn.id = 'quizFab';
  document.body.appendChild(btn);
}

// ─── Practice hub (final-exam.html) ────────────────────────────────────────
async function loadAllCards() {
  const parser = new DOMParser();
  const pages = await Promise.all(NAV.map(async n => {
    const res = await fetch(n.href);
    if (!res.ok) throw new Error(n.href + ': HTTP ' + res.status);
    const doc = parser.parseFromString(await res.text(), 'text/html');
    return [...doc.querySelectorAll('.qa-card')].map(c => deckItem(c, pageOf(n.href)));
  }));
  return pages.flat();
}

function practiceStats(items, srs) {
  return {
    due: items.filter(i => isDue(srs[i.key])),
    weak: items.filter(i => srs[i.key]?.last === 'again'),
    seen: items.filter(i => srs[i.key]).length,
  };
}

function statTile(num, label) {
  const t = el('div', 'practice-stat');
  t.append(el('div', 'num', String(num)), el('div', 'lbl', label));
  return t;
}

function topicChips(state, onChange) {
  const row = el('div', 'pillar-row practice-topics');
  NAV.filter(n => n.count).forEach(n => {
    const page = pageOf(n.href);
    const chip = el('button', 'pillar-chip active', n.label);
    chip.type = 'button';
    chip.dataset.page = page;
    chip.setAttribute('aria-pressed', 'true');
    chip.addEventListener('click', () => {
      const on = !state.topics.has(page);
      if (on) state.topics.add(page); else state.topics.delete(page);
      chip.classList.toggle('active', on);
      chip.setAttribute('aria-pressed', String(on));
      onChange();
    });
    row.appendChild(chip);
  });
  return row;
}

function modeCard(icon, title, desc, count, deck, onEnd) {
  const card = el('button', 'practice-mode');
  card.type = 'button';
  card.disabled = !deck.length;
  card.append(el('i', icon), el('h3', '', title), el('p', '', desc), el('span', 'practice-mode-count', count));
  card.addEventListener('click', () => startQuiz(deck, onEnd));
  return card;
}

function renderPractice(app, all, state) {
  const srs = loadSrs();
  const items = all.filter(i => state.topics.has(i.page));
  const { due, weak, seen } = practiceStats(items, srs);
  const rerender = () => renderPractice(app, all, state);
  const stats = el('div', 'practice-stats');
  stats.append(statTile(items.length, 'Cards selected'), statTile(due.length, 'Due today'),
    statTile(weak.length, 'Weak spots'), statTile(seen, 'Ever reviewed'));
  const modes = el('div', 'practice-modes');
  modes.append(
    modeCard('fa-solid fa-calendar-day', 'Due today', 'Cards your schedule says to review today. Do this daily.',
      due.length + ' due', shuffle(due), rerender),
    modeCard('fa-solid fa-user-tie', 'Mock interview', MOCK_SIZE + ' random questions mixed across the selected topics.',
      Math.min(MOCK_SIZE, items.length) + ' questions', mockDeck(items), rerender),
    modeCard('fa-solid fa-crosshairs', 'Weak spots', 'Every card you last rated "Need practice".',
      weak.length + ' cards', shuffle(weak), rerender));
  const empty = !due.length && !seen ? el('p', 'practice-note', 'Nothing is scheduled yet: start with a mock interview, and every card you rate gets a review date.') : '';
  app.querySelector('.practice-live').replaceChildren(stats, modes, empty);
  return { due, modes };
}

async function initPractice() {
  const app = document.getElementById('practiceApp');
  if (!app) return;
  if (location.protocol === 'file:') {
    app.appendChild(el('div', 'practice-note', 'Practice reads every topic page, which browsers block for files opened from disk. Open the GitHub Pages site, or run scripts/serve.sh and open http://localhost:8000/final-exam.html.'));
    return;
  }
  const loading = el('p', 'practice-note', 'Loading questions from every topic…');
  app.appendChild(loading);
  let all;
  try { all = await loadAllCards(); } catch (err) {
    loading.textContent = 'Could not load the topic pages (' + err.message + ').';
    return;
  }
  const state = { topics: new Set(NAV.filter(n => n.count).map(n => pageOf(n.href))) };
  const live = el('div', 'practice-live');
  app.replaceChildren(topicChips(state, () => renderPractice(app, all, state)), live);
  app.dataset.cards = String(all.length);
  const { due } = renderPractice(app, all, state);
  if (new URLSearchParams(location.search).get('mode') === 'due' && due.length) startQuiz(shuffle(due), () => renderPractice(app, all, state));
}

// ─── Dashboard study path (index.html) ─────────────────────────────────────
function studyCard(n, step, srs) {
  const page = pageOf(n.href);
  const mastered = readJson(MASTERY_PREFIX + page, []).filter(k => k.startsWith(page + ':')).length;
  const pct = n.count ? Math.min(100, Math.round(mastered / n.count * 100)) : 0;
  const due = Object.keys(srs).filter(k => k.startsWith(page + ':') && isDue(srs[k])).length;
  const card = el('a', 'study-card');
  card.href = n.href;
  const head = el('div', 'study-card-head');
  head.append(el('span', 'study-step', String(step)), el('i', n.icon), el('h3', '', n.label));
  const bar = el('div', 'progress-bar');
  const fill = el('div', 'progress-fill');
  fill.style.width = pct + '%';
  bar.appendChild(fill);
  const meta = el('div', 'study-card-meta', n.count ? mastered + ' / ' + n.count + ' mastered' : 'Read-through, no questions');
  if (due) meta.appendChild(el('span', 'study-due', due + ' due'));
  card.append(head, el('p', '', n.desc || ''), bar, meta);
  return card;
}

function initDashboard() {
  const path = document.getElementById('studyPath');
  if (!path) return;
  const srs = loadSrs();
  path.replaceChildren(...NAV.map((n, i) => studyCard(n, i + 1, srs)));
  const total = NAV.reduce((s, n) => s + n.count, 0);
  const due = Object.values(srs).filter(isDue).length;
  document.querySelectorAll('[data-total-questions]').forEach(e => { e.textContent = total; });
  document.querySelectorAll('[data-total-topics]').forEach(e => { e.textContent = NAV.length; });
  document.querySelectorAll('[data-due-count]').forEach(e => { e.textContent = due; });
}

document.addEventListener('DOMContentLoaded', () => {
  initQuizButton();
  initPractice();
  initDashboard();
});
