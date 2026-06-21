// ─── Theme ────────────────────────────────────────────────────────────────
const root = document.documentElement;
const THEME_KEY = 'interview-prep-theme';

function applyTheme(theme) {
  root.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggle');
  if (btn) {
    const icon = btn.querySelector('i') || document.createElement('i');
    icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    if (!btn.contains(icon)) btn.appendChild(icon);
    btn.childNodes.forEach(n => { if (n.nodeType === 3) n.remove(); });
  }
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved || 'dark');
}

function toggleTheme() {
  const current = root.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ─── Sidebar toggle (mobile: slide-in; desktop: collapse) ─────────────────
const SIDEBAR_KEY = 'interview-prep-sidebar';

function toggleSidebar() {
  const sb     = document.querySelector('.sidebar');
  const layout = document.querySelector('.layout');
  if (!sb) return;
  if (window.innerWidth <= 768) {
    sb.classList.toggle('open');
  } else {
    const isNowCollapsed = layout.classList.toggle('sidebar-collapsed');
    localStorage.setItem(SIDEBAR_KEY, isNowCollapsed ? 'collapsed' : 'open');
  }
}

function initSidebarState() {
  if (window.innerWidth > 768) {
    const saved = localStorage.getItem(SIDEBAR_KEY);
    if (saved === 'collapsed') {
      document.querySelector('.layout')?.classList.add('sidebar-collapsed');
    }
  }
}

function injectSidebarCollapseBtn() {
  // Hamburger in topbar
  const topbar = document.querySelector('.topbar');
  if (topbar && !topbar.querySelector('.menu-toggle')) {
    const btn = document.createElement('button');
    btn.className = 'menu-toggle';
    btn.title = 'Toggle sidebar';
    btn.setAttribute('aria-label', 'Toggle sidebar');
    btn.onclick = toggleSidebar;
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-bars';
    btn.appendChild(icon);
    topbar.insertBefore(btn, topbar.firstChild);
  }

  // Sticky tab on sidebar right edge — always visible even when sidebar is collapsed
  const sidebar = document.querySelector('.sidebar');
  if (sidebar && !sidebar.querySelector('.sidebar-edge-btn')) {
    const tab = document.createElement('button');
    tab.className = 'sidebar-edge-btn';
    tab.title = 'Toggle sidebar';
    tab.setAttribute('aria-label', 'Toggle sidebar');
    tab.onclick = toggleSidebar;
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-chevron-left';
    tab.appendChild(icon);
    sidebar.appendChild(tab);

    // Rotate icon when collapsed
    const layout = document.querySelector('.layout');
    if (layout) {
      new MutationObserver(function() {
        icon.style.transform = layout.classList.contains('sidebar-collapsed') ? 'rotate(180deg)' : '';
      }).observe(layout, { attributes: true, attributeFilter: ['class'] });
    }
  }
}

// ─── Q&A Accordion ────────────────────────────────────────────────────────
function initAccordion() {
  document.querySelectorAll('.qa-question').forEach(q => {
    q.addEventListener('click', () => {
      const card = q.closest('.qa-card');
      card.classList.toggle('open', !card.classList.contains('open'));
    });
  });
}

// ─── Mastery / Progress System ────────────────────────────────────────────
const MASTERY_PREFIX = 'interview-mastery-';
const PAGE_KEY = (location.pathname.split('/').pop() || 'index').replace('.html', '');
let masteredSet = new Set();

function loadMastery() {
  try {
    const raw = localStorage.getItem(MASTERY_PREFIX + PAGE_KEY);
    masteredSet = raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (e) { masteredSet = new Set(); }
}

function saveMastery() {
  localStorage.setItem(MASTERY_PREFIX + PAGE_KEY, JSON.stringify([...masteredSet]));
}

function updateProgress() {
  const total    = document.querySelectorAll('.qa-card').length;
  const mastered = document.querySelectorAll('.qa-card.mastered').length;
  const bar      = document.getElementById('progressFill');
  const label    = document.getElementById('progressLabel');
  if (!bar || total === 0) return;
  const pct = Math.round((mastered / total) * 100);
  bar.style.width = pct + '%';
  bar.style.background = pct >= 80 ? 'linear-gradient(90deg,#10b981,#34d399)'
                       : pct >= 40 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                       : 'linear-gradient(90deg,var(--accent),var(--accent-2))';
  if (label) label.textContent = `${mastered} / ${total} mastered`;
  const topbarNum   = document.getElementById('topbarMasteredNum');
  const topbarTotal = document.getElementById('topbarMasteredTotal');
  if (topbarNum)   topbarNum.textContent   = mastered;
  if (topbarTotal) topbarTotal.textContent = total;
  // Update sidebar progress bar
  const sbFill  = document.getElementById('sidebarProgressFill');
  const sbCount = document.getElementById('sidebarProgressCount');
  if (sbFill)  sbFill.style.width = pct + '%';
  if (sbCount) sbCount.textContent = mastered + ' / ' + total;
}

// ─── Sidebar Progress Widget ──────────────────────────────────────────────
function injectSidebarProgress() {
  const nav = document.querySelector('.sidebar-nav');
  if (!nav || document.querySelector('.sidebar-progress')) return;

  const wrap = document.createElement('div');
  wrap.className = 'sidebar-progress';

  const labelRow = document.createElement('div');
  labelRow.className = 'sidebar-progress-label';
  const labelText = document.createElement('span');
  labelText.textContent = 'PROGRESS';
  const countSpan = document.createElement('span');
  countSpan.id = 'sidebarProgressCount';
  countSpan.textContent = '0 / 0';
  labelRow.appendChild(labelText);
  labelRow.appendChild(countSpan);

  const barWrap = document.createElement('div');
  barWrap.className = 'sidebar-progress-bar';
  const fill = document.createElement('div');
  fill.className = 'sidebar-progress-fill';
  fill.id = 'sidebarProgressFill';
  barWrap.appendChild(fill);

  wrap.appendChild(labelRow);
  wrap.appendChild(barWrap);
  nav.parentNode.insertBefore(wrap, nav);
}

function updateSectionProgress() {
  document.querySelectorAll('.section-mini-progress').forEach(el => {
    const container = el.dataset.container
      ? document.querySelector(el.dataset.container)
      : el.closest('.section-block')?.querySelector('.qa-list, .content-area');
    if (!container) return;
    const cards    = container.querySelectorAll('.qa-card');
    const done     = container.querySelectorAll('.qa-card.mastered').length;
    const total    = cards.length;
    const pct      = total > 0 ? Math.round((done / total) * 100) : 0;
    el.querySelector('.smp-count').textContent = `${done} / ${total}`;
    const fill = el.querySelector('.smp-fill');
    if (fill) {
      fill.style.width = pct + '%';
      fill.style.background = pct === 100 ? '#10b981'
                            : pct >= 50  ? '#f59e0b'
                            : 'var(--accent)';
    }
    el.classList.toggle('smp-complete', done === total && total > 0);
  });
}

function toggleMastery(card, e) {
  if (e) e.stopPropagation();
  const key = card.dataset.cardKey;
  if (masteredSet.has(key)) {
    masteredSet.delete(key);
    card.classList.remove('mastered');
  } else {
    masteredSet.add(key);
    card.classList.add('mastered');
    // brief pop animation
    card.classList.add('mastery-pop');
    setTimeout(() => card.classList.remove('mastery-pop'), 400);
  }
  saveMastery();
  updateProgress();
  updateSectionProgress();
  updateSectionCounters();
}

function markCardMastered(card) {
  if (!card || masteredSet.has(card.dataset.cardKey)) return;
  masteredSet.add(card.dataset.cardKey);
  card.classList.add('mastered', 'mastery-pop');
  setTimeout(() => card.classList.remove('mastery-pop'), 400);
  saveMastery();
  updateProgress();
  updateSectionProgress();
}

function initMastery() {
  loadMastery();

  // Assign stable keys and inject mastery buttons
  document.querySelectorAll('.qa-card').forEach((card, idx) => {
    const key = PAGE_KEY + '-' + idx;
    card.dataset.cardKey = key;
    if (masteredSet.has(key)) card.classList.add('mastered');

    const btn = document.createElement('button');
    btn.className = 'mastery-btn';
    btn.title = 'Mark as mastered';
    btn.setAttribute('aria-label', 'Mark as mastered');
    btn.addEventListener('click', (e) => toggleMastery(card, e));
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-check';
    btn.appendChild(icon);

    const q = card.querySelector('.qa-question');
    const chevron = q?.querySelector('.qa-chevron');
    if (chevron) q.insertBefore(btn, chevron);
    else q?.appendChild(btn);
  });

  // Inject section-level mini-progress widgets
  document.querySelectorAll('.section-header').forEach(header => {
    const sibling = header.nextElementSibling;
    if (!sibling) return;
    const cards = sibling.querySelectorAll('.qa-card');
    if (!cards.length) return;

    const widget = document.createElement('div');
    widget.className = 'section-mini-progress';

    const count = document.createElement('span');
    count.className = 'smp-count';
    count.textContent = `0/${cards.length}`;
    widget.appendChild(count);

    const bar = document.createElement('div');
    bar.className = 'smp-bar';
    const fill = document.createElement('div');
    fill.className = 'smp-fill';
    bar.appendChild(fill);
    widget.appendChild(bar);

    const doneIcon = document.createElement('i');
    doneIcon.className = 'fa-solid fa-circle-check smp-done-icon';
    widget.appendChild(doneIcon);

    // Store a unique selector to find the container later
    if (!sibling.id) sibling.id = 'smp-container-' + Math.random().toString(36).slice(2, 7);
    widget.dataset.container = '#' + sibling.id;

    header.appendChild(widget);
  });

  updateProgress();
  updateSectionProgress();
}

// ─── Search ───────────────────────────────────────────────────────────────
function initSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    document.querySelectorAll('.qa-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = (!q || text.includes(q)) ? '' : 'none';
    });
  });
}

// ─── Filter by pillar ─────────────────────────────────────────────────────
function initPillarFilter() {
  document.querySelectorAll('.pillar-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const pillar = chip.dataset.pillar;
      document.querySelectorAll('.pillar-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      document.querySelectorAll('.qa-card').forEach(card => {
        const match = !pillar || card.dataset.pillar === pillar;
        card.style.display = match ? '' : 'none';
      });
    });
  });
}

// ─── Copy code ────────────────────────────────────────────────────────────
function initCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.closest('.code-block').querySelector('pre code');
      if (!code) return;
      navigator.clipboard.writeText(code.innerText).then(() => {
        const orig = btn.textContent;
        btn.textContent = '✓ Copied';
        setTimeout(() => { btn.textContent = orig; }, 1800);
      });
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ABBREVIATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

const ABBR_DICT = {
  // General / Interview
  'SLA':    'Service Level Agreement — a contract defining minimum acceptable performance (e.g. 99.9% uptime)',
  'SLO':    'Service Level Objective — an internal target stricter than the SLA, giving a safety margin',
  'SLI':    'Service Level Indicator — the actual measured metric used to track an SLO',
  'STAR':   'Situation, Task, Action, Result — the structured storytelling framework for behavioral interviews',
  'LP':     'Leadership Principle — one of Amazon\'s 16 core values probed in every behavioral interview',
  'PR':     'Pull Request — a request to review and merge a feature branch into the main branch',
  // Java / Spring
  'JVM':    'Java Virtual Machine — the runtime that executes Java bytecode and manages memory (GC, JIT)',
  'GC':     'Garbage Collector — the JVM process that automatically frees unused memory',
  'IoC':    'Inversion of Control — the container (Spring) creates and wires dependencies instead of your code',
  'DI':     'Dependency Injection — passing dependencies into a class (via constructor) rather than creating them inside',
  'AOP':    'Aspect-Oriented Programming — adding cross-cutting behaviour (logging, transactions) without changing business logic',
  'JPA':    'Java Persistence API — the Java specification for mapping objects to relational database tables (Hibernate implements it)',
  'ORM':    'Object-Relational Mapping — lets you work with database rows as Java objects instead of raw SQL',
  'DTO':    'Data Transfer Object — a simple data carrier between layers that doesn\'t expose internal entity fields',
  'JWT':    'JSON Web Token — a signed, self-contained token that carries identity claims without hitting a database',
  'OAuth':  'Open Authorization — a protocol for delegated access ("Login with Google") using access tokens',
  'OIDC':   'OpenID Connect — an identity layer on top of OAuth 2.0 that adds user authentication (who you are)',
  'OOM':    'Out of Memory — the JVM (or container) ran out of heap space; in K8s this shows as OOMKilled',
  'SOLID':  'Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion — the 5 OOP design principles',
  'ACID':   'Atomicity, Consistency, Isolation, Durability — the 4 properties that make database transactions reliable',
  // Architecture
  'API':    'Application Programming Interface — the defined contract for how software components talk to each other',
  'REST':   'Representational State Transfer — an API style using HTTP methods and URLs to represent resources',
  'gRPC':   'Google Remote Procedure Call — a high-performance RPC framework using Protobuf + HTTP/2 for inter-service calls',
  'CQRS':   'Command Query Responsibility Segregation — separating write (command) and read (query) models',
  'DDD':    'Domain-Driven Design — structuring code around the real-world business domain using Bounded Contexts and Aggregates',
  'CAP':    'Consistency, Availability, Partition tolerance — a theorem that a distributed system can guarantee only 2 of these 3',
  'BASE':   'Basically Available, Soft state, Eventually consistent — the distributed alternative to ACID used by NoSQL systems',
  'ACL':    'Anti-Corruption Layer — a translation boundary that prevents a legacy system\'s poor design from leaking into new services',
  'BFF':    'Backend For Frontend — a dedicated API gateway built specifically for one client type (mobile, web, partner)',
  'CDC':    'Change Data Capture — reading the database write log (WAL) to stream every data change to a message broker in real time',
  'WAL':    'Write-Ahead Log — PostgreSQL\'s internal sequential change log; used by Debezium for CDC without application changes',
  'mTLS':   'Mutual TLS — both client and server verify each other\'s certificates, used for zero-trust service-to-service auth',
  // Kubernetes
  'K8s':    'Kubernetes — open-source container orchestration: schedules containers, handles restarts, scaling, and routing',
  'HPA':    'Horizontal Pod Autoscaler — Kubernetes controller that adds/removes pod replicas based on CPU, memory or custom metrics',
  'VPA':    'Vertical Pod Autoscaler — adjusts CPU/memory limits of individual pods based on historical usage',
  'KEDA':   'Kubernetes Event-Driven Autoscaling — scales pods based on event queue depth (e.g. Kafka consumer lag)',
  'YAML':   'YAML Ain\'t Markup Language — human-readable format used for K8s manifests, Spring config, CI/CD pipelines',
  'CI/CD':  'Continuous Integration / Continuous Delivery — automated testing on every commit, then automated deploy to staging or production',
  // Kafka
  'ISR':    'In-Sync Replicas — the set of Kafka broker replicas fully caught up with the partition leader',
  'DLT':    'Dead Letter Topic — a Kafka topic where messages that failed all retry attempts are stored for later inspection',
  // Security / Observability
  'PII':    'Personally Identifiable Information — data that can identify a person (name, email, IP); must not appear in logs',
  'GDPR':   'General Data Protection Regulation — EU law governing how personal data is collected, stored and processed',
  'OWASP':  'Open Worldwide Application Security Project — publishes the Top 10 most critical web security risks',
  'XSS':    'Cross-Site Scripting — injecting malicious JavaScript into a web page that runs in other users\' browsers',
  'SQL':    'Structured Query Language — the standard language for relational databases (SELECT, INSERT, UPDATE, DELETE)',
};

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build a single regex for all abbreviations (longest first to avoid prefix conflicts)
function buildAbbrRegex() {
  const terms = Object.keys(ABBR_DICT).sort((a, b) => b.length - a.length);
  return new RegExp('(?<![\\w/])(' + terms.map(escapeRe).join('|') + ')(?![\\w/])', 'g');
}

// Walk text nodes, skip code blocks / nav / buttons
function collectTextNodes(root) {
  const SKIP_TAGS = new Set(['SCRIPT','STYLE','CODE','PRE','ABBR','INPUT','TEXTAREA','BUTTON','SELECT','TH']);
  const SKIP_CLASSES = ['code-block','sidebar','topbar','qa-num','qa-difficulty','nav-badge','copy-btn','section-icon','hero-stat','lp-num','star-label','pillar-chip','company-badge'];

  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      let el = node.parentElement;
      while (el && el !== root) {
        if (SKIP_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
        for (const cls of SKIP_CLASSES) {
          if (el.classList.contains(cls)) return NodeFilter.FILTER_REJECT;
        }
        el = el.parentElement;
      }
      return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  return nodes;
}

// Replace abbreviations in a single text node
function replaceInTextNode(textNode, pattern, seen) {
  const text = textNode.textContent;
  pattern.lastIndex = 0;
  if (!pattern.test(text)) return;
  pattern.lastIndex = 0;

  const frag = document.createDocumentFragment();
  let last = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const abbr  = match[1];
    const full  = ABBR_DICT[abbr];
    const first = !seen.has(abbr);
    if (first) seen.add(abbr);

    if (match.index > last) {
      frag.appendChild(document.createTextNode(text.slice(last, match.index)));
    }

    const el = document.createElement('abbr');
    el.title = full;
    el.dataset.abbr  = abbr;
    el.dataset.first = first ? '1' : '0';
    el.textContent   = first ? `${abbr} (${abbr})` : abbr; // will be corrected by applyAbbrMode
    frag.appendChild(el);

    last = match.index + match[0].length;
  }

  if (last === 0) return;
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));

  textNode.parentNode.replaceChild(frag, textNode);
}

function wrapAbbreviations() {
  const content = document.querySelector('.content');
  if (!content) return;

  const pattern = buildAbbrRegex();
  const seen    = new Set();
  const nodes   = collectTextNodes(content);
  nodes.forEach(n => replaceInTextNode(n, pattern, seen));
}

// ─── Topbar extras: Done counter + Reset button ───────────────────────────
function injectTopbarExtras() {
  const topbar = document.querySelector('.topbar');
  const themeBtn = document.getElementById('themeToggle');
  if (!topbar || !themeBtn) return;

  const stat = document.createElement('span');
  stat.id = 'topbarMasteredStat';
  stat.className = 'topbar-stat';
  stat.appendChild(document.createTextNode('Mastered: '));
  const numEl = document.createElement('strong');
  numEl.id = 'topbarMasteredNum';
  numEl.textContent = '0';
  stat.appendChild(numEl);
  stat.appendChild(document.createTextNode('/'));
  const totalEl = document.createElement('span');
  totalEl.id = 'topbarMasteredTotal';
  totalEl.textContent = '0';
  stat.appendChild(totalEl);
  topbar.insertBefore(stat, themeBtn);

  const resetBtn = document.createElement('button');
  resetBtn.className = 'topbar-action-btn';
  resetBtn.title = 'Reset all mastery progress for this page';
  const resetIcon = document.createElement('i');
  resetIcon.className = 'fa-solid fa-rotate-left';
  resetBtn.appendChild(resetIcon);
  resetBtn.appendChild(document.createTextNode(' Reset'));
  resetBtn.addEventListener('click', () => {
    if (!confirm('Reset mastery progress for this page?')) return;
    masteredSet.clear();
    saveMastery();
    document.querySelectorAll('.qa-card.mastered').forEach(c => c.classList.remove('mastered'));
    updateProgress();
    updateSectionProgress();
    updateSectionCounters();
  });
  topbar.insertBefore(resetBtn, themeBtn);
}

// ─── Active nav link ─────────────────────────────────────────────────────
function highlightNav() {
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#')) return; // section links handled by scrollspy
    a.classList.toggle('active', href === path || (path === '' && href === 'index.html'));
  });
}

// ─── Scroll Spy (highlight active section in sidebar as user scrolls) ────
function initScrollSpy() {
  const sectionLinks = Array.from(document.querySelectorAll('.nav-link[href^="#"]'));
  if (!sectionLinks.length) return;

  const idToLink = {};
  sectionLinks.forEach(a => {
    const id = a.getAttribute('href').slice(1);
    if (id) idToLink[id] = a;
  });

  const targets = Object.keys(idToLink)
    .map(id => document.getElementById(id))
    .filter(Boolean);
  if (!targets.length) return;

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        sectionLinks.forEach(a => a.classList.remove('active'));
        const link = idToLink[e.target.id];
        if (link) link.classList.add('active');
      }
    });
  }, { rootMargin: '-10% 0px -80% 0px' });

  targets.forEach(el => obs.observe(el));
}

// ─── Personal Notes (per card, saved to localStorage) ────────────────────
const NOTES_PREFIX = 'interview-notes-';

function initNotes() {
  document.querySelectorAll('.qa-card').forEach((card, idx) => {
    const noteKey = NOTES_PREFIX + PAGE_KEY + '-' + idx;
    const saved   = localStorage.getItem(noteKey) || '';

    const wrap = document.createElement('div');
    wrap.className = 'qa-notes';
    wrap.addEventListener('click', e => e.stopPropagation());

    const label = document.createElement('div');
    label.className = 'qa-notes-label';
    const noteIcon = document.createElement('i');
    noteIcon.className = 'fa-solid fa-pen-to-square';
    label.appendChild(noteIcon);
    label.appendChild(document.createTextNode(' My Notes'));
    const savedSpan = document.createElement('span');
    savedSpan.className = 'qa-notes-saved';
    label.appendChild(savedSpan);

    const ta = document.createElement('textarea');
    ta.className = 'qa-notes-ta';
    ta.placeholder = 'Add your own notes, key points, or interview reminders…';
    ta.value = saved;
    ta.rows = 3;

    let timer;
    ta.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        localStorage.setItem(noteKey, ta.value);
        card.classList.toggle('has-notes', !!ta.value.trim());
        savedSpan.textContent = ' ✓ saved';
        setTimeout(() => { savedSpan.textContent = ''; }, 1500);
      }, 400);
    });

    if (saved.trim()) card.classList.add('has-notes');
    wrap.appendChild(label);
    wrap.appendChild(ta);
    card.appendChild(wrap);
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────
// ─── Section Collapse ─────────────────────────────────────────────────────
const SECTION_COLLAPSE_KEY = 'interview-section-collapsed-';

function initSectionCollapse() {
  const content = document.querySelector('.content');
  if (!content) return;

  const headers = Array.from(content.querySelectorAll('.section-header'));
  if (!headers.length) return;

  const pageKey = (location.pathname.split('/').pop() || 'index').replace('.html', '');

  headers.forEach(function(header, idx) {
    var id = header.id || ('section-' + idx);
    var storageKey = SECTION_COLLAPSE_KEY + pageKey + '-' + id;

    // Extract icon, title, subtitle from existing section-header
    var iconEl   = header.querySelector('.section-icon');
    var h2       = header.querySelector('h2');
    var p        = header.querySelector('p');
    var title    = h2 ? h2.textContent : id;
    var subtitle = p  ? p.textContent  : '';

    // Build toggle button
    var toggle = document.createElement('button');
    toggle.className = 'section-collapse-toggle';

    // Show icon if section has one; else fall back to number badge
    if (iconEl) {
      var iconClone = iconEl.cloneNode(true);
      iconClone.className = 'section-collapse-icon-wrap';
      toggle.appendChild(iconClone);
    } else {
      var numSpan = document.createElement('span');
      numSpan.className = 'section-collapse-num';
      numSpan.textContent = String(idx + 1);
      toggle.appendChild(numSpan);
    }

    var textSpan = document.createElement('span');
    textSpan.className = 'section-collapse-text';
    var h3 = document.createElement('h3');
    h3.textContent = title;
    textSpan.appendChild(h3);
    if (subtitle) {
      var pEl = document.createElement('p');
      pEl.textContent = subtitle;
      textSpan.appendChild(pEl);
    }
    toggle.appendChild(textSpan);

    // Mastery counter — shows "X / Y" mastered in this section
    var counterSpan = document.createElement('span');
    counterSpan.className = 'section-collapse-counter';
    counterSpan.dataset.sectionId = id;
    toggle.appendChild(counterSpan);

    var chevron = document.createElement('i');
    chevron.className = 'fa-solid fa-chevron-down section-collapse-chevron';
    toggle.appendChild(chevron);

    // Collect all siblings until next section-header (or end)
    var siblings = [];
    var next = header.nextElementSibling;
    while (next && !next.classList.contains('section-header')) {
      siblings.push(next);
      next = next.nextElementSibling;
    }

    // Wrap siblings in collapse body
    var body = document.createElement('div');
    body.className = 'section-collapse-body';
    siblings.forEach(function(el) { body.appendChild(el); });

    // Create group wrapper — preserve original id so anchor links + scrollspy still work
    var group = document.createElement('div');
    group.className = 'section-group';
    group.id = id;

    // Replace section-header with group containing toggle + body
    header.parentNode.insertBefore(group, header);
    group.appendChild(toggle);
    group.appendChild(body);
    header.remove();

    // Restore state
    if (localStorage.getItem(storageKey) === '1') {
      group.classList.add('collapsed');
    }

    // Toggle on click
    toggle.addEventListener('click', function() {
      var isNowCollapsed = group.classList.toggle('collapsed');
      localStorage.setItem(storageKey, isNowCollapsed ? '1' : '0');
    });
  });
}

function updateSectionCounters() {
  document.querySelectorAll('.section-collapse-counter').forEach(function(counter) {
    var group = counter.closest('.section-group');
    if (!group) return;
    var cards    = group.querySelectorAll('.qa-card');
    var mastered = group.querySelectorAll('.qa-card.mastered');
    counter.textContent = mastered.length + ' / ' + cards.length;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSectionCollapse();
  initAccordion();
  initSearch();
  initPillarFilter();
  initCopyButtons();
  highlightNav();
  initScrollSpy();
  injectSidebarProgress();
  injectTopbarExtras();
  updateProgress();
  wrapAbbreviations();
  initSidebarState();
  injectSidebarCollapseBtn();
  initMastery();
  updateSectionCounters();
  initNotes();
});
