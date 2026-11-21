#!/usr/bin/env node
// Browser checks for the site, driven through the real UI.
//
//   node scripts/check-browser.js diagrams [baseUrl]   measure every diagram in dark + light theme
//   node scripts/check-browser.js flows    [baseUrl]   click through the main user flows
//
// baseUrl defaults to http://localhost:8000 (start it with scripts/serve.sh).
// Playwright is not a project dependency: the copy bundled with the global @playwright/mcp
// package is used, with an installed chrome-headless-shell. Override with PLAYWRIGHT_MODULE / CHROME_PATH.
const path = require('path');
const fs = require('fs');

const PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE || '/opt/homebrew/lib/node_modules/@playwright/mcp/node_modules/playwright';
const CHROME = process.env.CHROME_PATH || path.join(process.env.HOME,
  'Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const { chromium } = require(PLAYWRIGHT);

const [mode, baseArg] = process.argv.slice(2);
const BASE = (baseArg || 'http://localhost:8000').replace(/\/$/, '');
const SHOTS = path.join(__dirname, '..', 'screenshots', 'diagrams');

async function navPages(page) {
  await page.goto(BASE + '/index.html');
  return page.evaluate(() => NAV.map(n => ({ href: n.href, count: n.count })));
}

// ─── diagrams ──────────────────────────────────────────────────────────────
// Runs in the page: returns the issues of every svg inside .content.
function measureDiagrams() {
  const PAD = 1;
  const box = el => el.getBoundingClientRect();
  const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
                         Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const inside = (t, s, pad = 0) => t.left >= s.left - pad && t.right <= s.right + pad && t.top >= s.top - pad && t.bottom <= s.bottom + pad;
  const contains = (s, x, y) => x >= s.left && x <= s.right && y >= s.top && y <= s.bottom;
  const label = t => JSON.stringify(t.textContent.trim().slice(0, 40));
  function linePoints(line) {
    const m = line.getScreenCTM();
    const pt = (x, y) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
    const n = a => line[a].baseVal.value;
    return [pt(n('x1'), n('y1')), pt(n('x2'), n('y2'))];
  }
  // Liang–Barsky: does segment p→q pass through rect r?
  function segmentHits(p, q, r) {
    let t0 = 0, t1 = 1;
    const dx = q.x - p.x, dy = q.y - p.y;
    for (const [pp, qq] of [[-dx, p.x - r.left], [dx, r.right - p.x], [-dy, p.y - r.top], [dy, r.bottom - p.y]]) {
      if (pp === 0) { if (qq < 0) return false; continue; }
      const t = qq / pp;
      if (pp < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return true;
  }
  return [...document.querySelectorAll('.content svg')].filter(s => s.closest('.pat-svg, .uml-svg')).map((svg, idx) => {
    const issues = [];
    const sb = box(svg);
    const texts = [...svg.querySelectorAll('text')].filter(t => t.textContent.trim()).map(t => ({ t, r: box(t) }));
    const shapes = [...svg.querySelectorAll('rect, circle, ellipse')].map(s => ({ s, r: box(s) })).filter(s => s.r.width < sb.width - 2 || s.r.height < sb.height - 2);
    const lines = [...svg.querySelectorAll('line')].map(linePoints);
    // An HTML element inside SVG text is not rendered, so its words silently vanish.
    if (svg.querySelector('text *:not(tspan)')) issues.push('non-SVG element inside <text> (invisible)');
    texts.forEach(({ t, r }, i) => {
      if (!inside(r, sb, -4 + PAD)) issues.push('clipped/edge ' + label(t));
      texts.slice(i + 1).forEach(o => { if (area(r, o.r) > 6) issues.push('overlap ' + label(t) + ' / ' + label(o.t)); });
      const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
      const holders = shapes.filter(s => contains(s.r, cx, cy)).sort((a, b) => a.r.width * a.r.height - b.r.width * b.r.height);
      if (holders[0] && !inside(r, holders[0].r, PAD)) issues.push('overflows its shape ' + label(t));
      shapes.forEach(s => {
        if (s === holders[0] || inside(r, s.r, PAD) || inside(s.r, r)) return;
        if (area(r, s.r) > 6 && !holders.includes(s)) issues.push('straddles a shape edge ' + label(t));
      });
      const core = { left: r.left + 1, right: r.right - 1, top: r.top + 2, bottom: r.bottom - 2 };
      if (lines.some(([p, q]) => segmentHits(p, q, core))) issues.push('line through ' + label(t));
    });
    return { idx, issues: [...new Set(issues)] };
  });
}

async function openAllCards(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.qa-card').forEach(c => c.classList.add('open'));
    document.querySelectorAll('.section-group.collapsed').forEach(g => g.classList.remove('collapsed'));
  });
}

async function diagrams() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pages = (await navPages(page)).map(n => n.href);
  let total = 0, bad = 0;
  for (const theme of ['dark', 'light']) {
    for (const href of pages) {
      await page.goto(BASE + '/' + href);
      await page.evaluate(t => applyTheme(t), theme);
      await openAllCards(page);
      const results = await page.evaluate(measureDiagrams);
      const svgs = page.locator('.content .pat-svg svg, .content .uml-svg svg');
      for (const r of results) {
        total++;
        const name = href.replace('.html', '') + '-' + r.idx + '-' + theme;
        await svgs.nth(r.idx).screenshot({ path: path.join(SHOTS, name + '.png') });
        if (r.issues.length) { bad++; console.log('FAIL', name, '\n   ' + r.issues.join('\n   ')); }
        else console.log('ok  ', name);
      }
    }
  }
  await browser.close();
  console.log(`\n${total - bad}/${total} diagrams ok, screenshots in screenshots/diagrams/`);
  process.exit(bad ? 1 : 0);
}

// ─── flows ─────────────────────────────────────────────────────────────────
function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function sidebarLinks(page) {
  return page.$$eval('.sidebar a.nav-link', as => as.map(a => a.getAttribute('href')).filter(h => !h.startsWith('#')).join(' '));
}

async function checkEveryPage(page, pages, errors) {
  let reference = null;
  for (const href of ['index.html', 'final-exam.html', ...pages.map(p => p.href)]) {
    await page.goto(BASE + '/' + href);
    const links = await sidebarLinks(page);
    reference = reference || links;
    assert(links === reference, href + ': sidebar differs\n  ' + links + '\n  ' + reference);
    const cards = await page.locator('.qa-card').count();
    const nav = pages.find(p => p.href === href);
    if (nav) assert(cards === nav.count, href + ': ' + cards + ' cards, NAV says ' + nav.count);
  }
  assert(!errors.length, 'console errors:\n  ' + errors.join('\n  '));
  console.log('ok   sidebar identical on', pages.length + 2, 'pages, no console errors');
}

async function checkCardAndCopy(page) {
  await page.goto(BASE + '/kafka.html');
  const card = page.locator('.qa-card').filter({ has: page.locator('.copy-btn') }).first();
  await card.locator('.qa-question').click();
  assert(await card.evaluate(c => c.classList.contains('open')), 'card did not open');
  await card.locator('.copy-btn').first().click();
  const expected = await card.locator('pre code').first().textContent();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert(clip.trim() === expected.trim(), 'clipboard does not hold the code block');
  console.log('ok   card opens, Copy puts the code on the clipboard');
}

async function checkMasteryPersists(page) {
  await page.goto(BASE + '/kafka.html');
  const card = page.locator('.qa-card').nth(2);
  await card.locator('.mastery-btn').click();
  await page.reload();
  assert(await page.locator('.qa-card').nth(2).evaluate(c => c.classList.contains('mastered')), 'mastery lost on reload');
  await page.locator('.qa-card').nth(2).locator('.mastery-btn').click();
  console.log('ok   mastered card survives reload');
}

async function visibleCards(page) {
  return page.$$eval('.qa-card', cs => cs.filter(c => c.offsetParent !== null).length);
}

async function checkFilters(page) {
  await page.goto(BASE + '/microservices.html');
  const total = await page.locator('.qa-card').count();
  await page.locator('.pillar-chip:not([data-pillar=""])').first().click();
  const some = await visibleCards(page);
  assert(some > 0 && some < total, 'pillar chip did not filter (' + some + '/' + total + ')');
  await page.locator('.pillar-chip[data-pillar=""]').click();
  assert(await visibleCards(page) === total, '"All" does not show every card');
  await page.fill('#searchInput', 'idempoten');
  const hits = await visibleCards(page);
  const emptyHidden = await page.locator('.section-group.filtered-out').count();
  assert(hits > 0 && hits < total && emptyHidden > 0, 'search: ' + hits + ' hits, ' + emptyHidden + ' empty sections hidden');
  await page.fill('#searchInput', '');
  assert(await visibleCards(page) === total, 'clearing search does not restore every card');
  console.log('ok   pillar filter, "All", search hides cards and empty sections');
}

async function checkTestYourself(page) {
  await page.goto(BASE + '/system-design.html');
  await page.click('#quizFab');
  for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
  assert(await page.evaluate(() => !!document.activeElement.closest('.quiz-modal')), 'Tab left the quiz dialog');
  const q = (await page.textContent('.quiz-question')).replace(/\s+/g, ' ').trim();
  await page.click('.quiz-btn.reveal');
  assert(await page.locator('.quiz-answer-box.visible').count() === 1, 'answer not revealed');
  await page.click('.quiz-btn.got-it');
  await page.keyboard.press('Escape');
  assert(await page.evaluate(() => document.activeElement.id === 'quizFab'), 'focus not returned to the quiz button');
  const r = await page.evaluate(q => {
    const card = [...document.querySelectorAll('.qa-card')].find(c => questionText(c) === q);
    return { mastered: card.classList.contains('mastered'), srs: loadSrs()[card.dataset.cardKey], tomorrow: dayString(1) };
  }, q);
  assert(r.mastered, 'Got it did not master the card');
  assert(r.srs && r.srs.box === 0 && r.srs.due === r.tomorrow, 'srs entry wrong: ' + JSON.stringify(r.srs));
  console.log('ok   Test yourself: focus stays in dialog, reveal, Got it, card mastered, due tomorrow, focus returns');
}

async function checkPractice(page, pages) {
  await page.goto(BASE + '/final-exam.html');
  await page.waitForSelector('.practice-mode');
  const cards = +(await page.getAttribute('#practiceApp', 'data-cards'));
  const expected = pages.reduce((s, p) => s + p.count, 0);
  assert(cards === expected, 'Practice loaded ' + cards + ' cards, NAV total is ' + expected);
  await page.locator('.practice-mode', { hasText: 'Mock interview' }).click();
  const topics = new Set();
  let n = 0;
  while (await page.locator('.quiz-question').count()) {
    topics.add(await page.locator('.quiz-topic').textContent());
    await page.click('.quiz-btn.skip');
    n++;
  }
  assert(n === 20 && topics.size >= 4, 'mock interview served ' + n + ' questions from ' + topics.size + ' topics');
  console.log('ok   Practice loads', cards, 'cards; mock interview = 20 questions from', topics.size, 'topics');
}

async function checkLegacyMigration(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '/kafka.html');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('interview-mastery-kafka', JSON.stringify(['kafka-0', 'kafka-3']));
    localStorage.setItem('interview-notes-kafka-0', 'legacy note');
  });
  await page.reload();
  const r = await page.evaluate(() => {
    const old = [...document.querySelectorAll('.qa-card:not([data-new])')];
    return {
      mastered: [...document.querySelectorAll('.qa-card.mastered')].map(c => old.indexOf(c)),
      note: old[0].querySelector('.qa-notes-ta').value,
      leftover: localStorage.getItem('interview-notes-kafka-0'),
    };
  });
  await ctx.close();
  assert(JSON.stringify(r.mastered) === '[0,3]', 'legacy mastery mapped to ' + JSON.stringify(r.mastered));
  assert(r.note === 'legacy note' && r.leftover === null, 'legacy note not migrated');
  console.log('ok   legacy keys kafka-0/kafka-3 and the old note migrate to the same questions');
}

async function flows() {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    const pages = await navPages(page);
    await checkEveryPage(page, pages, errors);
    await checkCardAndCopy(page);
    await checkMasteryPersists(page);
    await checkFilters(page);
    await checkTestYourself(page);
    await checkPractice(page, pages);
    await checkLegacyMigration(browser);
    assert(!errors.length, 'console errors:\n  ' + errors.join('\n  '));
    console.log('\nflows: PASS');
  } catch (e) {
    console.log('FAIL ', e.message, '\nflows: FAIL');
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

if (mode === 'diagrams') diagrams();
else if (mode === 'flows') flows();
else { console.log('usage: node scripts/check-browser.js diagrams|flows [baseUrl]'); process.exit(2); }
