/**
 * End-to-end scenario (real browser, real API, real database):
 *   merchant registers → cashier adds order → customer opens store QR page and links the order →
 *   cashier taps "Ready" → customer gets the full-screen alert → cashier "Picked up" → customer rates.
 * Usage: WEB=http://localhost:5173 OUT=./screens node e2e/flow.cjs
 */
const { chromium, devices } = require('playwright');
const assert = require('node:assert');
const fs = require('node:fs');

const WEB = process.env.WEB || 'http://localhost:5173';
const OUT = process.env.OUT || './screens';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });

  // ── Merchant (tablet-sized cashier screen)
  const merchant = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ar' });
  const m = await merchant.newPage();
  m.on('pageerror', (e) => console.error('[merchant pageerror]', e.message));
  await m.goto(`${WEB}/register`);
  const email = `owner-${Date.now()}@example.com`;
  await m.fill('input[minlength="2"] >> nth=0', 'مقهى الاختبار');
  const inputs = m.locator('form input');
  await inputs.nth(2).fill('مالك الاختبار');
  await inputs.nth(3).fill(email);
  await inputs.nth(4).fill('Passw0rd1');
  await m.click('button[type=submit]');
  await m.waitForURL('**/app/brand');
  await m.goto(`${WEB}/app/orders`);
  await m.waitForSelector('.order-input');

  // add two orders, close the QR modal
  for (const n of ['125', '126']) {
    await m.fill('.order-input', n);
    await m.keyboard.press('Enter');
    await m.waitForSelector('.qr-display');
    if (n === '125') await shot(m, '03-cashier-order-qr');
    await m.click('.modal header button');
  }
  await m.waitForSelector('[data-testid="ticket-126"]');

  // find the store slug from the branches page API
  const slug = await m.evaluate(async () => {
    const t = JSON.parse(localStorage.getItem('uyt.tokens'));
    const brandId = localStorage.getItem('uyt.brand');
    const r = await fetch(`/api/brands/${brandId}`, { headers: { authorization: `Bearer ${t.accessToken}` } });
    return (await r.json()).branches[0].slug;
  });

  // ── Customer (phone)
  const customer = await browser.newContext({ ...devices['iPhone 13'], locale: 'ar' });
  const c = await customer.newPage();
  c.on('pageerror', (e) => console.error('[customer pageerror]', e.message));
  await c.goto(`${WEB}/s/${slug}`);
  await c.waitForSelector('.cx-input');
  await shot(c, '05-customer-store-landing');
  await c.fill('.cx-input', '١٢٥'); // Arabic digits are accepted
  await c.click('button.cx-btn');
  await c.waitForURL('**/o/**');
  await c.waitForSelector('.cx-ring');
  await shot(c, '06-customer-preparing');

  // cashier sees the phone linked in realtime
  await m.waitForSelector('[data-testid="ticket-125"] .chip.ok', { timeout: 10000 });
  await shot(m, '02-cashier-board');

  // ── Ready
  await m.click('[data-testid="ticket-125"] .btn.red');
  await c.waitForSelector('.cx-ready', { timeout: 10000 });
  await shot(c, '07-customer-ready-alert');
  await m.waitForSelector('[data-testid="ticket-125"].is-ready');
  await shot(m, '02b-cashier-board-ready');
  await c.click('.cx-ready .cx-btn');

  // ── Picked up → rating + Google
  await m.click('[data-testid="ticket-125"] .actions .btn.lg');
  await c.waitForSelector('.cx-stars', { timeout: 10000 });
  await c.click('.cx-stars button >> nth=4');
  await c.fill('.cx-textarea', 'خدمة سريعة جدًا');
  await c.click('text=إرسال التقييم');
  await c.waitForSelector('text=شكرًا على تقييمك');
  await shot(c, '08-customer-thanks');

  // privacy: another phone cannot open this order
  const intruder = await browser.newContext({ ...devices['Pixel 7'], locale: 'ar' });
  const i = await intruder.newPage();
  await i.goto(c.url());
  await i.waitForSelector('text=هذا الطلب غير مربوط بهذا الجهاز');

  // history shows the order with its rating
  await m.goto(`${WEB}/app/history`);
  await m.waitForSelector('.stars');
  const historyText = await m.textContent('.table');
  assert(historyText.includes('#125'));

  console.log('E2E OK – full pickup flow passed');
  await browser.close();
})().catch((e) => {
  console.error('E2E FAILED', e);
  process.exit(1);
});
