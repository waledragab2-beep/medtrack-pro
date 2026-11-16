/**
 * DEMO DATA ONLY.
 * Creates a clearly-labelled demo brand ("UYT Demo Café — DEMO") so the dashboards can be explored.
 * Every row is marked is_demo = true. Real merchants sign up through /register and never see this data.
 *
 *   npm run seed:demo              # brand, menu, offers, staff
 *   npm run seed:demo -- --history # + 30 days of synthetic orders for the analytics screens
 */
import { pool, withTx } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { hashPassword, randomToken, fourDigitCode } from '../src/lib/security.js';

const DEMO_EMAIL = 'demo@uyt.app';
const DEMO_PASSWORD = 'Demo1234';
const CASHIER_EMAIL = 'cashier@uyt.app';

async function main() {
  await migrate(() => {});
  const withHistory = process.argv.includes('--history');

  await withTx(async (c) => {
    await c.query(`DELETE FROM brands WHERE slug = 'uyt-demo' AND is_demo`);
    const { rows: [brand] } = await c.query(
      `INSERT INTO brands (slug, name, name_en, tagline, tagline_en, theme, social, google_review_url, is_demo,
                           subscription_status, timezone, currency)
       VALUES ('uyt-demo', 'كافيه UYT التجريبي', 'UYT Demo Café', 'بيانات تجريبية — DEMO', 'Demo data — not a real store',
               '{"primary":"#E10600","background":"#0A0A0A","surface":"#161616","text":"#FFFFFF"}',
               '{"instagram":"https://instagram.com/","facebook":"https://facebook.com/","tiktok":"https://tiktok.com/"}',
               'https://maps.google.com/', true, 'active', 'Africa/Cairo', 'EGP')
       RETURNING id`,
    );
    const { rows: [branch] } = await c.query(
      `INSERT INTO branches (brand_id, slug, name, address, lat, lng, maps_url, opening_hours, avg_prep_minutes)
       VALUES ($1, 'demo', 'فرع تجريبي — DEMO', 'عنوان تجريبي', 30.0444, 31.2357,
               'https://maps.google.com/?q=30.0444,31.2357', '8:00 – 24:00', 6)
       ON CONFLICT (slug) DO UPDATE SET brand_id = EXCLUDED.brand_id RETURNING id`,
      [brand.id],
    );

    for (const [email, name, role] of [
      [DEMO_EMAIL, 'Demo Owner', 'owner'],
      [CASHIER_EMAIL, 'Demo Cashier', 'cashier'],
    ] as const) {
      const { rows: [u] } = await c.query(
        `INSERT INTO users (email, password_hash, full_name) VALUES ($1,$2,$3)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash RETURNING id`,
        [email, await hashPassword(DEMO_PASSWORD), name],
      );
      await c.query(`INSERT INTO memberships (user_id, brand_id, role) VALUES ($1,$2,$3)`, [u.id, brand.id, role]);
    }

    const cats = [
      ['مشروبات ساخنة', 'Hot drinks', [['إسبريسو', 'Espresso', 45], ['لاتيه', 'Latte', 65], ['كابتشينو', 'Cappuccino', 60]]],
      ['مشروبات باردة', 'Iced drinks', [['آيس لاتيه', 'Iced latte', 70], ['موهيتو', 'Mojito', 55]]],
      ['حلويات', 'Desserts', [['تشيز كيك', 'Cheesecake', 85], ['كرواسون', 'Croissant', 40]]],
    ] as const;
    let sort = 0;
    for (const [name, nameEn, items] of cats) {
      const { rows: [cat] } = await c.query(
        `INSERT INTO menu_categories (brand_id, name, name_en, sort) VALUES ($1,$2,$3,$4) RETURNING id`,
        [brand.id, name, nameEn, sort++],
      );
      for (const [n, ne, price] of items) {
        await c.query(`INSERT INTO menu_items (brand_id, category_id, name, name_en, price) VALUES ($1,$2,$3,$4,$5)`, [
          brand.id, cat.id, n, ne, price,
        ]);
      }
    }
    await c.query(
      `INSERT INTO offers (brand_id, title, title_en, description, description_en, badge) VALUES
       ($1, 'خصم 20% على المشروبات الباردة (تجريبي)', '20% off iced drinks (demo)', 'عرض تجريبي للتوضيح فقط', 'Demo offer for illustration', '-20%'),
       ($1, 'القهوة الثانية بنصف السعر (تجريبي)', 'Second coffee half price (demo)', 'عرض تجريبي للتوضيح فقط', 'Demo offer for illustration', '1+½')`,
      [brand.id],
    );

    if (withHistory) {
      // Synthetic, clearly-flagged orders for the last 30 days (busier mornings and evenings).
      let n = 0;
      for (let day = 30; day >= 1; day--) {
        const count = 20 + Math.floor(Math.random() * 25);
        for (let i = 0; i < count; i++) {
          const hour = [8, 9, 10, 13, 14, 18, 19, 20, 21][Math.floor(Math.random() * 9)];
          const prep = 180 + Math.floor(Math.random() * 360);
          const pickup = 30 + Math.floor(Math.random() * (Math.random() < 0.1 ? 600 : 180));
          const { rows: [o] } = await c.query(
            `INSERT INTO orders (brand_id, branch_id, order_number, status, claim_secret, claim_code, is_demo,
                                 created_at, ready_at, picked_up_at)
             VALUES ($1,$2,$3,'picked_up',$4,$5,true,
                     date_trunc('day', now() - make_interval(days => $6)) + make_interval(hours => $7, mins => $8),
                     date_trunc('day', now() - make_interval(days => $6)) + make_interval(hours => $7, mins => $8, secs => $9),
                     date_trunc('day', now() - make_interval(days => $6)) + make_interval(hours => $7, mins => $8, secs => $9 + $10))
             RETURNING id`,
            [brand.id, branch.id, String(100 + (n++ % 900)), randomToken(18), fourDigitCode(), day, hour, Math.floor(Math.random() * 59), prep, pickup],
          );
          if (Math.random() < 0.85) {
            const { rows: [d] } = await c.query(
              `INSERT INTO order_devices (order_id, brand_id, token_hash, platform, push_provider, revoked_at)
               VALUES ($1,$2,$3,'web','webpush', now()) RETURNING id`,
              [o.id, brand.id, Buffer.from(randomToken(24))],
            );
            await c.query(
              `INSERT INTO notifications (brand_id, order_id, device_id, kind, dedupe_key, provider, status, attempts, sent_at, delivered_at)
               VALUES ($1,$2,$3,'ready',$4,'webpush','delivered',1, now(), now())`,
              [brand.id, o.id, d.id, `demo:${o.id}`],
            );
          }
          if (Math.random() < 0.3) {
            const stars = Math.random() < 0.75 ? 5 : Math.random() < 0.7 ? 4 : 3;
            await c.query(`INSERT INTO ratings (order_id, brand_id, branch_id, stars, created_at) VALUES ($1,$2,$3,$4, now() - make_interval(days => $5))`, [
              o.id, brand.id, branch.id, stars, day,
            ]);
          }
        }
      }
      console.log(`created ${n} DEMO orders`);
    }
  });

  console.log(`DEMO brand ready → store page /s/demo
  owner:   ${DEMO_EMAIL} / ${DEMO_PASSWORD}
  cashier: ${CASHIER_EMAIL} / ${DEMO_PASSWORD}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
