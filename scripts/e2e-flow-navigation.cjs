// Back-navigation and question-flow check for dist/flow.html: every screen reachable and leavable by
// visible controls, in a sandboxed frame (like the claude.ai viewer) and as a plain page. Run from a
// folder holding flow.html and host.html (an iframe sandbox="allow-scripts" around flow.html).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0, oks = 0;
  for (const [mode, w] of [['framed-desktop', 1280], ['framed-phone', 390], ['plain-phone', 390]]) {
    const page = await (await b.newContext({ viewport: { width: w, height: 860 } })).newPage();
    page.on('pageerror', e => errs.push(mode + ': ' + e.message));
    page.on('console', m => m.type() === 'error' && errs.push(mode + ': ' + m.text()));
    let p;
    if (mode.startsWith('framed')) { await page.goto('file://' + __dirname + '/host.html', { waitUntil: 'networkidle' }); p = page.frameLocator('#f'); }
    else { await page.goto('file://' + __dirname + '/flow.html', { waitUntil: 'networkidle' }); p = page; }
    await page.waitForTimeout(500);
    const where = async () => {
      const step = (await p.locator('nav [aria-current=step]:visible').first().textContent().catch(() => '')).trim();
      const h = (await p.locator('main h1:visible, main h2:visible').first().textContent().catch(() => '')).trim();
      return `${step} | ${h.slice(0, 32)}`;
    };
    const expect = async (label, want) => {
      await page.waitForTimeout(180);
      const w2 = await where(); const ok = w2.includes(want);
      ok ? oks++ : fails++;
      if (!ok || mode === 'framed-phone') console.log(mode.padEnd(15), ok ? 'ok  ' : 'FAIL', label.padEnd(40), '→', w2);
    };
    const click = (sel) => p.locator(sel + ':visible').first().click();
    const count = (sel) => p.locator(sel + ':visible').count();
    await expect('start', 'המצב');
    // upgrader: old home questions appear in step 1
    await click('[role=radio]:has-text("משפרי דיור")'); await expect('card → question 1', 'הכסף');
    console.log(mode, '  q1 fields: old home value', await count('label:has-text("שווה")'), '| years', await count('label:has-text("לכמה שנים")'));
    await click('button:has-text("הבא: הדירה")'); await expect('next → question 2', 'הדירה');
    console.log(mode, '  q2: price', await count('label:has-text("מחיר")'), '| term', await count('label:has-text("משכנתא")'));
    await click('button:has-text("הבא: התחזית")'); await expect('next → question 3', 'התחזית');
    await click('button:has-text("הבא: תוספות")'); await expect('next → question 4', 'תוספות');
    const sw = await count('[role=switch]'); console.log(mode, '  q4 add-on switches', sw);
    const before = await count('input[type=range]');
    await click('[role=switch]'); await page.waitForTimeout(150);
    console.log(mode, '  switching an add-on opens its fields:', (await count('input[type=range]')) > before);
    await click('button:has-text("הצג תוצאה")'); await expect('show result', 'התוצאה');
    await click('button:has-text("→ חזרה")'); await expect('back from result', 'תוספות');
    await click('button:has-text("→ חזרה")'); await expect('back', 'התחזית');
    await click('button:has-text("→ חזרה")'); await expect('back', 'הדירה');
    await click('button:has-text("→ חזרה")'); await expect('back', 'הכסף');
    await click('button:has-text("→ חזרה")'); await expect('back to start', 'המצב');
    for (const [i, n] of [[2, 'הדירה'], [5, 'התוצאה'], [0, 'המצב'], [3, 'התחזית']]) {
      await click(`nav ol li:nth-child(${i + 1}) button`); await expect(`progress bar → ${n}`, n);
    }
    await click('button:has-text("דלגו לתוצאה")'); await expect('skip to result', 'התוצאה');
    await click('button:has-text("לעבור שוב על השאלות")'); await expect('"go through again"', 'הכסף');
    await click('nav ol li:nth-child(6) button'); await click('button:has-text("בחירת מצב אחר")'); await expect('"another situation"', 'המצב');
    await click('[role=radio]:has-text("דירה ראשונה להשקעה")'); await click('button:has-text("דלגו לתוצאה")');
    await click('a:has-text("למסלול המודרך")'); await expect('result → guided', 'מה יש לכם');
    await click('button:has-text("→ חזרה")'); await expect('guided back', 'התוצאה');
    await click('header a:has-text("נדל״ן מול סנופי")'); await click('a:has-text("לא בטוחים")'); await expect('"not sure" → guided', 'מה יש לכם');
    await click('a:has-text("נדל״ן מול סנופי")'); await expect('guided header → back', 'המצב');
    if (mode === 'plain-phone') {
      await click('[role=radio]:has-text("משפרי דיור")'); await click('button:has-text("הבא: הדירה")');
      await page.goBack(); await expect('browser back', 'הכסף');
      await page.goBack(); await expect('browser back again', 'המצב');
    }
    console.log(mode, '  overflow', await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  }
  console.log('ok', oks, 'fails', fails, 'errors', errs); await b.close();
})();
