# Changelog

All notable changes to Prima License Manager are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [1.0.0] — 2026-07-16

### Added
- Initial release of Prima License Manager.
- Clean-architecture MVC core: DI container with autowiring, HTTP router with
  named parameters and middleware, PDO database layer, native-PHP view engine,
  session, CSRF, validator and file logger.
- Built-in PSR-4 autoloader (Composer optional).
- Complete relational database schema with foreign keys, indexes, constraints,
  views and seed data; forward-only migration system.
- Modules: Dashboard, Customers, Products, Software Versions, Licenses,
  License Generator, Devices, Feature Modules, Users, Roles, Permissions,
  Audit Logs, Notifications, Reports, Settings, Backups/Restore, Profile.
- License engine: unique numbers/keys, 8 license types, AES-256 encrypted and
  RSA-4096 signed `.lic`/`.key`/`.dat` files, QR codes, printable certificates,
  revoke/renew lifecycle.
- Hardware fingerprinting (SHA-256) with device activation limits, blocking and
  deactivation.
- Reusable, dependency-free License SDK (`Prima\LicenseSDK\License`) supporting
  offline signature verification and online API operations.
- REST API (v1) with API-key and JWT authentication and per-IP rate limiting.
- Self-contained QR code generator (versions 1–40, Reed–Solomon ECC, SVG).
- Self-contained SMTP mail client (STARTTLS/SSL) with `mail()` fallback.
- Reports exportable to CSV, Excel (SpreadsheetML) and printable PDF/HTML.
- Backup/restore via pure-PHP SQL dumps and ZIP file archives.
- Six-step web installation wizard.
- CLI console for migrations, seeding, backups and cron maintenance tasks.
- Professional Bootstrap 5 admin UI: responsive, Dark/Light themes, LTR/RTL
  (English + Arabic), Chart.js dashboards and DataTables — all bundled locally.
- Security: Argon2id hashing, CSRF, prepared statements, output escaping,
  login rate limiting/lockout, secure session cookies, security headers.

[1.0.0]: https://example.com/plm/releases/1.0.0
