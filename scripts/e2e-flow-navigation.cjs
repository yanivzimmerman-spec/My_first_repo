// Back-navigation check for dist/flow.html: every screen reachable and leavable by visible controls,
// inside a sandboxed frame (like the claude.ai viewer) and as a plain page. Run from a folder holding
// flow.html and host.html (an iframe sandbox="allow-scripts" around flow.html): node e2e-flow-navigation.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  for (const [mode, w] of [['framed-desktop', 1280], ['framed-phone', 390], ['plain-phone', 390]]) {
    const page = await (await b.newContext({ viewport: { width: w, height: 860 } })).newPage();
    page.on('pageerror', e => errs.push(mode + ': ' + e.message));
    page.on('console', m => m.type() === 'error' && errs.push(mode + ': ' + m.text()));
    let p;
    if (mode.startsWith('framed')) { await page.goto('file://' + __dirname + '/host.html', { waitUntil: 'networkidle' }); p = page.frameLocator('#f'); }
    else { await page.goto('file://' + __dirname + '/flow.html', { waitUntil: 'networkidle' }); p = page; }
    await page.waitForTimeout(500);
    const where = async () => {
      const step = await p.locator('nav [aria-current=step]:visible').first().textContent().catch(() => '');
      const h = await p.locator('main h1:visible, main h2:visible').first().textContent().catch(() => '');
      return `${step.trim()} | ${h.trim().slice(0, 30)}`;
    };
    const expect = async (label, want) => {
      await page.waitForTimeout(200);
      const w2 = await where(); const ok = w2.includes(want);
      if (!ok) fails++;
      console.log(mode.padEnd(15), ok ? 'ok  ' : 'FAIL', label.padEnd(42), '→', w2);
    };
    const click = (sel) => p.locator(sel + ':visible').first().click();
    await expect('start', 'המצב שלכם');
    await click('[role=radio]:has-text("משפרי דיור")'); await expect('card', 'הנתונים');
    await click('button:has-text("חזרה לבחירת המצב")'); await expect('back button on numbers', 'המצב שלכם');
    await click('nav button:has-text("2.")'); await expect('progress bar → 2', 'הנתונים');
    await click('button:has-text("הצג תוצאה")'); await expect('show result', 'התוצאה');
    await click('button:has-text("חזרה לנתונים")'); await expect('back button on result', 'הנתונים');
    await click('nav button:has-text("3.")'); await expect('progress bar → 3', 'התוצאה');
    await click('nav button:has-text("1.")'); await expect('progress bar → 1', 'המצב שלכם');
    await click('nav button:has-text("3.")'); await expect('progress bar 1 → 3', 'התוצאה');
    await click('button:has-text("שינוי הנתונים")'); await expect('"change numbers" on result', 'הנתונים');
    await click('button:has-text("הצג תוצאה")'); await click('button:has-text("בחירת מצב אחר")'); await expect('"another situation" on result', 'המצב שלכם');
    await click('nav button:has-text("3.")'); await click('a:has-text("למסלול המודרך")'); await expect('result → guided path', 'מה יש לכם');
    await click('button:has-text("→ חזרה")'); await expect('guided step 1 back button', 'התוצאה');
    await click('nav button:has-text("1.")'); await click('a:has-text("לא בטוחים")'); await expect('card "not sure" → guided', 'מה יש לכם');
    await click('button:has-text("הבא:")'); await click('button:has-text("הבא:")');
    await click('a:has-text("נדל״ן מול סנופי")'); await expect('guided header link → back', 'המצב שלכם');
    await click('a:has-text("לא בטוחים")'); await page.waitForTimeout(200);
    await expect('guided keeps its step', 'הבסיס');
    await click('button:has-text("הבא:")'); await page.waitForTimeout(400);
    await click('button:has-text("לשחק עם כל הפרטים")'); await expect('guided → full result', 'התוצאה');
    await click('button:has-text("חזרה לנתונים")'); await expect('back from that result', 'דירה או שוק ההון');
    await click('a:has-text("נדל״ן מול סנופי")'); await expect('and out again (to where it was opened)', 'המצב שלכם');
    await click('header a:has-text("נדל״ן מול סנופי")'); await expect('logo → start', 'המצב שלכם');
    if (mode === 'plain-phone') {
      await click('nav button:has-text("2.")'); await click('button:has-text("הצג תוצאה")');
      await page.goBack(); await expect('browser back (plain page)', 'הנתונים');
      await page.goBack(); await expect('browser back again', 'המצב שלכם');
    }
  }
  console.log('fails', fails, 'errors', errs); await b.close();
})();
