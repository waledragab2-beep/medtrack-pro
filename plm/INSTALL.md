# Installation Guide — Prima License Manager

This guide covers installation on **Hostinger shared hosting** and any similar
Apache + PHP 8.3 + MySQL 8 environment.

---

## 1. Prepare hosting

1. Create a MySQL database and user in **hPanel → Databases → MySQL Databases**.
   Note the database name, username, password and host (usually `localhost`).
2. Ensure PHP is set to **8.3** in **hPanel → Advanced → PHP Configuration**.
3. Confirm these PHP extensions are enabled: `pdo_mysql`, `openssl`,
   `mbstring`, `json`, `fileinfo`.

---

## 2. Upload the application

Upload the contents of the `plm/` directory to your account, then choose one of:

**Option A — document root on `public/` (recommended)**
Point your domain to `…/plm/public` in **hPanel → Domains**. Only the
`public/` folder is web-accessible; all source and storage stay private.

**Option B — application at the web root**
Upload `plm/` so its contents sit at your web root (e.g. `public_html/`). The
included root `.htaccess` transparently forwards requests into `public/` and
blocks direct access to `app/`, `config/`, `storage/`, etc.

---

## 3. Set permissions

Make the storage tree writable (the installer also creates sub-folders):

```
chmod -R 775 storage
chmod 775 config          # so the installer can write database.local.php
```

---

## 4. (Optional) Install Composer dependencies

The app ships with a built-in PSR-4 autoloader and requires **no** third-party
packages, so this step is optional. If you have Composer:

```
composer install --no-dev --optimize-autoloader
```

---

## 5. Run the installation wizard

Open `https://your-domain/` in a browser. You will be redirected to
`/install`. Complete the six steps:

1. **Server Check** — verifies PHP version, extensions and writable paths.
2. **Database Configuration** — enter your MySQL credentials. The database is
   created automatically if it does not exist, and the connection is tested.
3. **Create Admin Account** — your super-administrator login.
4. **Generate Encryption Keys** — creates the application secret and the
   RSA-4096 key pair used to sign and encrypt licenses.
5. **Install Database** — imports the schema and seed data and creates your
   admin account.
6. **Finish** — installation complete.

The installer writes `config/database.local.php` (your credentials) and
`storage/installed.lock`. Both are excluded from version control.

---

## 6. Post-installation hardening

- Delete or restrict the `installer/` directory.
- Verify `storage/` and `config/` are **not** directly web-accessible
  (Option A guarantees this; Option B enforces it via `.htaccess`).
- Enable HTTPS and uncomment the HSTS / force-HTTPS blocks in
  `public/.htaccess`.
- Back up `storage/keys/` securely — losing the RSA private key means existing
  license files can no longer be re-issued or verified against a new key.

---

## 7. Command-line maintenance (optional)

If you have SSH/cron access:

```
php bin/console.php migrate          # apply migrations
php bin/console.php migrate:status   # view migration state
php bin/console.php licenses:expire  # expire overdue licenses
php bin/console.php notify:renewals  # generate renewal reminders
php bin/console.php backup:db        # database backup
```

Schedule the maintenance commands via Hostinger cron jobs (see README).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Blank page / 500 | Set `PLM_DEBUG=true` in the environment, check `storage/logs/`. |
| "Application secret is missing" | Re-run the installer's key generation step. |
| Assets not loading | Confirm the document root / `.htaccess` and that `mod_rewrite` is enabled. |
| DB connection failed | Re-check credentials; on Hostinger the host is usually `localhost`. |
| Cannot write config | `chmod 775 config` before running the installer. |
