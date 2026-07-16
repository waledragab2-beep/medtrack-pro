# Prima License Manager (PLM)

**Offline License & Activation Management System — Version 1.0**

Prima License Manager is a complete, commercial-grade PHP application for
issuing, signing, distributing and validating software licenses. It is built
to run on **standard Hostinger shared hosting** (PHP 8.3, MySQL 8, Apache)
with **no external runtime services** — no Node.js, Docker, Redis, or
framework dependencies.

---

## Features

- **Dashboard** — real-time statistics, revenue/activation charts, expiring
  licenses and recent activity.
- **Customers** — full CRM-style customer records with licenses per customer.
- **Products & Versions** — product catalogue with software version tracking
  and licensable feature modules.
- **Licenses** — generate signed, encrypted licenses of 8 types (Trial,
  Monthly, Quarterly, Semi-Annual, Yearly, Lifetime, Developer, Enterprise)
  with user/device/branch limits, QR codes and printable certificates.
- **License files** — export `.lic`, `.key`, `.dat` (AES-256 encrypted,
  RSA-4096 signed binary containers).
- **Devices & Hardware Fingerprint** — SHA-256 hardware binding, activation
  limits, device blocking and deactivation.
- **License SDK** — a reusable, dependency-free PHP SDK for client products to
  verify licenses **offline** (RSA signature) or **online** (REST API).
- **REST API** — activation / verification / deactivation endpoints secured by
  API keys or JWT, with per-IP rate limiting.
- **Users, Roles & Permissions** — granular RBAC with system and custom roles.
- **Reports** — customer, product, license, renewal, expired, activation and
  revenue reports, exportable to CSV, Excel and PDF/print.
- **Audit Logs, Login Logs, Activation Logs** — complete security trail.
- **Settings** — company profile, SMTP (self-contained SMTP client), theme,
  locale, currency, encryption key management.
- **Backups & Restore** — pure-PHP SQL dumps and file archives, restore from
  upload.
- **Installer** — a six-step web installation wizard.
- **Modern UI** — Bootstrap 5, responsive, Dark/Light mode, LTR/RTL
  (English + Arabic), charts (Chart.js) and DataTables — all bundled locally.

---

## Security

- AES-256-CBC encryption with HMAC integrity (encrypt-then-MAC).
- RSA-4096 digital signatures (SHA-256) for tamper-proof licenses.
- Argon2id password hashing.
- CSRF protection on all state-changing requests.
- Prepared statements everywhere (PDO) — no string-built SQL with user input.
- Output escaping by default in views.
- Login rate limiting and account lockout.
- Secure, HttpOnly, SameSite session cookies with periodic regeneration.
- Security headers via `.htaccess`.

---

## Requirements

| Component | Minimum |
|-----------|---------|
| PHP       | 8.3 (with `pdo_mysql`, `openssl`, `mbstring`, `json`, `fileinfo`) |
| MySQL     | 8.0 |
| Web server| Apache with `mod_rewrite` |
| Composer  | Optional (a built-in PSR-4 autoloader is used as fallback) |

---

## Quick Start

1. Upload the `plm/` directory to your hosting account.
2. Point your domain's document root at `plm/public` **or** upload so that the
   root `.htaccess` forwards traffic into `public/`.
3. Visit `https://your-domain/` — you will be redirected to the installer.
4. Complete the six-step wizard (requirements → database → admin → keys →
   install → finish).
5. Sign in and start issuing licenses.

See [INSTALL.md](INSTALL.md) for detailed, step-by-step instructions.

---

## Project Structure

```
plm/
├── app/
│   ├── Core/          Framework (router, container, database, auth, view…)
│   ├── Controllers/   HTTP controllers (+ Api/ for JSON endpoints)
│   ├── Models/        Data models (active-record style over PDO)
│   ├── Services/      Encryption, License, Fingerprint, Mail, Backup, Export…
│   ├── Libraries/     Self-contained QR code generator
│   ├── Middleware/    Auth, CSRF, Permission, API key
│   ├── LicenseSDK/    Reusable client SDK (Prima\LicenseSDK\License)
│   ├── Database/      Migration runner
│   ├── Helpers/       Global helper functions
│   └── Views/         PHP templates (layouts, partials, modules)
├── config/            Configuration (app, database)
├── database/          Schema, seeds, migrations
├── public/            Web root (front controller + assets)
├── routes/            Web and API route maps
├── storage/           Logs, uploads, temp, backups, keys (writable)
├── installer/         Installer redirect
├── bin/console.php    CLI console (migrate, seed, backup, cron tasks)
└── composer.json
```

---

## License SDK Example

```php
use Prima\LicenseSDK\License;

// Fetch the server's public key once (or bundle it with your product).
$publicKey = file_get_contents('public.pem');

$license = License::load('/path/to/app.lic', $publicKey);

if ($license->verify() && !$license->isExpired()) {
    echo "Licensed to customer #{$license->customer()}\n";
    echo "Modules: " . implode(', ', $license->modules()) . "\n";
    echo "Days remaining: " . ($license->daysRemaining() ?? 'lifetime') . "\n";

    // Optional online activation binding this device.
    $result = $license->activate('https://your-domain/api/v1/licenses', [
        'cpu'          => '…',
        'motherboard'  => '…',
        'disk_serial'  => '…',
        'mac_address'  => '…',
        'bios_uuid'    => '…',
        'machine_guid' => '…',
    ]);
}
```

---

## Cron Jobs (optional)

Add these on Hostinger to automate maintenance:

```
# Expire overdue licenses daily at 00:10
10 0 * * * php /home/USER/plm/bin/console.php licenses:expire

# Generate renewal reminders every morning at 07:00
0 7 * * * php /home/USER/plm/bin/console.php notify:renewals

# Nightly database backup at 02:00
0 2 * * * php /home/USER/plm/bin/console.php backup:db
```

---

## License

Proprietary. See [LICENSE.md](LICENSE.md).
