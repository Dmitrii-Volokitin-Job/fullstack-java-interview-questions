#!/usr/bin/env python3
"""Static structure + link check for the site. Stdlib only.

Usage: python3 scripts/check-site.py
Prints OK and exits 0, or lists every problem and exits 1.
"""
import pathlib
import re
import sys
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parent.parent
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
NOT_TOPIC_PAGES = {'index.html', 'final-exam.html'}
EXTERNAL = re.compile(r'^(https?:|mailto:|data:|javascript:|//)')
DIFFICULTY = {'diff-easy': 'Easy', 'diff-medium': 'Medium', 'diff-hard': 'Hard'}
ASSETS = ('js/app.js', 'js/quiz.js', 'css/styles.css')
MIN_SVG_FONT = 11


class Node:
    parent: 'Node'

    def __init__(self, tag, attrs, line, parent):
        self.tag, self.attrs, self.line, self.parent = tag, dict(attrs), line, parent
        self.children, self.text = [], []

    @property
    def classes(self):
        return set((self.attrs.get('class') or '').split())

    def walk(self):
        yield self
        for c in self.children:
            yield from c.walk()

    def find(self, cls):
        return [n for n in self.walk() if cls in n.classes]

    def child(self, cls):
        return next((c for c in self.children if cls in c.classes), None)

    def text_content(self):
        return ''.join(self.text) + ''.join(c.text_content() for c in self.children)

    def inside(self, cls):
        n = self.parent
        while n:
            if cls in n.classes:
                return True
            n = n.parent
        return False


class TreeBuilder(HTMLParser):
    def __init__(self, page, problems):
        super().__init__(convert_charrefs=True)
        self.page, self.problems = page, problems
        self.root = Node('#root', [], 0, None)
        self.cur: Node = self.root

    def err(self, line, msg):
        self.problems.append(f'{self.page}:{line}: {msg}')

    def handle_starttag(self, tag, attrs):
        line = self.getpos()[0]
        names = [a for a, _ in attrs]
        dupes = {a for a in names if names.count(a) > 1}
        if dupes:
            self.err(line, f'duplicate attribute(s) {sorted(dupes)} on <{tag}>')
        node = Node(tag, attrs, line, self.cur)
        self.cur.children.append(node)
        if tag not in VOID:
            self.cur = node

    def handle_startendtag(self, tag, attrs):
        node = Node(tag, attrs, self.getpos()[0], self.cur)
        self.cur.children.append(node)

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        n = self.cur
        while n is not self.root and n.tag != tag:
            n = n.parent
        if n is self.root:
            self.err(self.getpos()[0], f'stray </{tag}>')
            return
        if n is not self.cur:
            self.err(self.getpos()[0], f'</{tag}> closes <{self.cur.tag}> opened at line {self.cur.line}')
        self.cur = n.parent

    def handle_data(self, data):
        self.cur.text.append(data)

    def close(self):
        super().close()
        if self.cur is not self.root:
            self.err(self.cur.line, f'<{self.cur.tag}> never closed')


def parse(path, problems):
    src = path.read_text()
    tb = TreeBuilder(path.name, problems)
    tb.feed(src)
    tb.close()
    return src, tb.root


def read_nav():
    js = (ROOT / 'js/app.js').read_text()
    block = re.search(r'const NAV = \[(.*?)\];', js, re.S).group(1)
    nav = [(m[1], int(m[2])) for m in re.finditer(r"href:\s*'([^']+)'.*?count:\s*(\d+)", block)]
    home = re.findall(r"href:\s*'([^']+)'", re.search(r'const NAV_HOME = \[(.*?)\];', js, re.S).group(1))
    return nav, home


def check_cards(page, root, err):
    questions = {}
    for card in root.find('qa-card'):
        q = card.child('qa-question')
        a = card.child('qa-answer')
        if not q or not a:
            err(card.line, 'card lacks .qa-question or .qa-answer child')
            continue
        parts = {c: q.child(c) for c in ('qa-num', 'qa-question-text', 'qa-difficulty', 'qa-chevron')}
        missing = [c for c, n in parts.items() if n is None]
        if missing:
            err(card.line, f'card question lacks {missing}')
            continue
        diff = parts['qa-difficulty']
        kind = [c for c in diff.classes if c in DIFFICULTY]
        if len(kind) != 1 or diff.text_content().strip() != DIFFICULTY[kind[0]]:
            err(diff.line, 'difficulty must be diff-easy|diff-medium|diff-hard with matching label')
        text = ' '.join(parts['qa-question-text'].text_content().split())
        if text in questions:
            err(card.line, f'duplicate question (also line {questions[text]}): {text[:60]}')
        questions[text] = card.line
    return questions


def check_pillars(root, err):
    chips = {n.attrs.get('data-pillar', '') for n in root.find('pillar-chip')}
    used = {c.attrs.get('data-pillar', '') for c in root.find('qa-card')}
    if not chips or used == {''}:
        return
    if 'all' in chips:
        err(0, 'pillar chip "all" must be data-pillar=""')
    for p in sorted(used - chips):
        err(0, f'cards use pillar "{p}" but no chip exists')
    for p in sorted(chips - used - {''}):
        err(0, f'chip "{p}" has no cards')


def check_svgs(root, err):
    for svg in (n for n in root.walk() if n.tag == 'svg'):
        if not (svg.inside('pat-svg') or svg.inside('uml-svg')):
            if svg.inside('qa-answer') or svg.inside('feature-card'):
                err(svg.line, 'diagram svg must sit inside .pat-svg')
            continue
        for n in svg.walk():
            size = n.attrs.get('font-size')
            if size and float(re.sub(r'[^\d.]', '', size) or 0) < MIN_SVG_FONT:
                err(n.line, f'svg font-size {size} < {MIN_SVG_FONT}')


def check_shell(page, src, root, err, versions):
    if '<aside class="sidebar"></aside>' not in src:
        err(0, 'sidebar must be the empty <aside class="sidebar"></aside> (rendered from NAV)')
    if not root.find('content'):
        err(0, 'no <div class="content"> wrapper')
    for asset in ASSETS:
        m = re.search(re.escape(asset) + r'\?v=(\d+)', src)
        if not m:
            err(0, f'missing {asset}?v=N')
        else:
            versions.setdefault(asset, {})[page] = m[1]


def check_page(path, problems, ids_by_page, links, versions):
    page = path.name
    src, root = parse(path, problems)

    def err(line, msg):
        problems.append(f'{page}:{line}: {msg}')

    seen = {}
    for n in root.walk():
        i = n.attrs.get('id')
        if i is None:
            continue
        if i in seen:
            err(n.line, f'duplicate id "{i}" (first at line {seen[i]})')
        seen[i] = n.line
    ids_by_page[page] = set(seen)
    for n in root.walk():
        for attr in ('href', 'src'):
            v = n.attrs.get(attr)
            if v is None:
                continue
            if v.strip() in ('', '#'):
                err(n.line, f'dead {attr}="{v}"')
            elif not EXTERNAL.match(v):
                links.append((page, n.line, v))
    if '<code">' in src:
        err(0, f'{src.count("<code\">")} malformed <code"> tag(s)')
    for m in re.finditer(r'\.innerHTML\s*[+]?=', src):
        err(src[:m.start()].count('\n') + 1, 'innerHTML assignment')
    check_shell(page, src, root, err, versions)
    check_svgs(root, err)
    check_pillars(root, err)
    return check_cards(page, root, err)


def check_links(links, ids_by_page, problems):
    for page, line, v in links:
        target, _, anchor = v.partition('#')
        file = target.split('?')[0] or page
        if not (ROOT / file).exists():
            problems.append(f'{page}:{line}: broken link {v}')
        elif anchor and file.endswith('.html') and anchor not in ids_by_page.get(file, set()):
            problems.append(f'{page}:{line}: missing anchor {v}')


def main():
    problems, ids_by_page, links, versions = [], {}, [], {}
    pages = sorted(ROOT.glob('*.html'))
    questions = {}
    for path in pages:
        questions[path.name] = check_page(path, problems, ids_by_page, links, versions)
    check_links(links, ids_by_page, problems)

    owner = {}
    for page, qs in questions.items():
        for q in qs:
            if q in owner:
                problems.append(f'{page}: question also on {owner[q]}: {q[:60]}')
            owner.setdefault(q, page)

    for asset, per_page in versions.items():
        if len(set(per_page.values())) > 1:
            problems.append(f'{asset}: pages disagree on ?v= {per_page}')

    for js in sorted((ROOT / 'js').glob('*.js')):
        for i, line in enumerate(js.read_text().splitlines(), 1):
            if re.search(r'\.innerHTML\s*[+]?=', line):
                problems.append(f'js/{js.name}:{i}: innerHTML assignment')

    nav, home = read_nav()
    nav_pages = {h for h, _ in nav}
    for href in [h for h, _ in nav] + home:
        if not (ROOT / href).exists():
            problems.append(f'NAV: {href} does not exist')
    for path in pages:
        if path.name not in NOT_TOPIC_PAGES and path.name not in nav_pages:
            problems.append(f'NAV: topic page {path.name} missing from NAV')
    for href, count in nav:
        real = len(questions.get(href, {}))
        if href in questions and real != count:
            problems.append(f'NAV count: {href} says {count}, page has {real}')

    if problems:
        print('\n'.join(problems))
        print(f'\n{len(problems)} problem(s)')
        sys.exit(1)
    print('OK')


if __name__ == '__main__':
    main()
