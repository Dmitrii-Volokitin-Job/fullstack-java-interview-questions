# Full-Stack Java Interview Prep

Static study site for full-stack Java interviews: Java 8–21, Spring Boot, SQL, design patterns, microservices, Kafka, system design, Kubernetes, Angular & web, soft skills and big-tech loops.

Live: https://dmitrii-volokitin-job.github.io/fullstack-java-interview-questions/

## How to study

- Say the answer aloud before you open a card, then rate it with **Test yourself** (Got it / Need practice).
- Ratings schedule cards with spaced repetition (Leitner boxes: 1, 3, 7, 14, 30 days).
- **Practice** (`final-exam.html`): *Due today*, *Mock interview* (20 mixed questions), *Weak spots*.
- Progress is stored in this browser's localStorage only.

## Run locally

```
scripts/serve.sh          # python3 -m http.server 8000
open http://localhost:8000
```

Practice needs a server (it fetches the topic pages); it does not work from `file://`.

## Checks

```
python3 scripts/check-site.py                                  # links, anchors, tags, NAV counts
node scripts/check-browser.js diagrams [http://localhost:8000] # diagram overlap/clipping, dark + light
node scripts/check-browser.js flows    [http://localhost:8000] # real-UI user flows
```

`check-browser.js` uses the Playwright copy bundled with the global `@playwright/mcp` package
(`/opt/homebrew/lib/node_modules/@playwright/mcp/node_modules/playwright`) and
`~/Library/Caches/ms-playwright/chromium_headless_shell-1243/.../chrome-headless-shell`.
Override with `PLAYWRIGHT_MODULE` and `CHROME_PATH`.

No build step, no dependencies: plain HTML, `css/styles.css`, `js/app.js`, `js/quiz.js`.
