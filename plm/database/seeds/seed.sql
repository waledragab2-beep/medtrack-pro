-- =====================================================================
--  Prima License Manager (PLM) — Seed Data
--  Note: The default admin account is created by the installer with a
--  password chosen by the operator. This seed provides roles, permissions,
--  base settings, feature modules and demonstration reference data.
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
--  ROLES
-- ---------------------------------------------------------------------
INSERT INTO `roles` (`name`, `slug`, `description`, `is_system`) VALUES
    ('Super Administrator', 'super-admin', 'Full unrestricted access to the entire system.', 1),
    ('Administrator',       'admin',       'Manage all modules except system-critical settings.', 1),
    ('License Manager',     'license-manager', 'Create and manage licenses, customers and products.', 0),
    ('Support Agent',       'support',     'Read-only access with activation support tools.', 0),
    ('Auditor',             'auditor',     'Read-only access to reports and audit logs.', 0)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- ---------------------------------------------------------------------
--  PERMISSIONS
-- ---------------------------------------------------------------------
INSERT INTO `permissions` (`name`, `slug`, `module`) VALUES
    ('View Dashboard',      'dashboard.view',   'dashboard'),
    ('View Customers',      'customers.view',   'customers'),
    ('Manage Customers',    'customers.manage', 'customers'),
    ('View Products',       'products.view',    'products'),
    ('Manage Products',     'products.manage',  'products'),
    ('View Licenses',       'licenses.view',    'licenses'),
    ('Manage Licenses',     'licenses.manage',  'licenses'),
    ('View Devices',        'devices.view',     'devices'),
    ('Manage Devices',      'devices.manage',   'devices'),
    ('View Users',          'users.view',       'users'),
    ('Manage Users',        'users.manage',     'users'),
    ('View Roles',          'roles.view',       'roles'),
    ('Manage Roles',        'roles.manage',     'roles'),
    ('View Audit Logs',     'audit.view',       'audit'),
    ('View Reports',        'reports.view',     'reports'),
    ('View Settings',       'settings.view',    'settings'),
    ('Manage Settings',     'settings.manage',  'settings'),
    ('Manage Backups',      'backups.manage',   'backups'),
    ('View Notifications',  'notifications.view','notifications')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Super admin gets every permission.
INSERT IGNORE INTO `role_permission` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.slug = 'super-admin';

-- Admin gets everything except manage settings/backups reserved to super-admin.
INSERT IGNORE INTO `role_permission` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM roles r JOIN permissions p
WHERE r.slug = 'admin'
  AND p.slug NOT IN ('roles.manage');

-- License manager: customers, products, licenses, devices, reports.
INSERT IGNORE INTO `role_permission` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM roles r JOIN permissions p
WHERE r.slug = 'license-manager'
  AND p.module IN ('dashboard','customers','products','licenses','devices','reports','notifications');

-- Support: read-only + device management.
INSERT IGNORE INTO `role_permission` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM roles r JOIN permissions p
WHERE r.slug = 'support'
  AND p.slug IN ('dashboard.view','customers.view','licenses.view','devices.view','devices.manage','notifications.view');

-- Auditor: read-only reports and audit.
INSERT IGNORE INTO `role_permission` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM roles r JOIN permissions p
WHERE r.slug = 'auditor'
  AND p.slug IN ('dashboard.view','reports.view','audit.view','licenses.view','customers.view');

-- ---------------------------------------------------------------------
--  SETTINGS (defaults)
-- ---------------------------------------------------------------------
INSERT INTO `settings` (`group_name`, `key_name`, `value`, `type`, `is_secret`) VALUES
    ('company', 'company_name',    'Prima Software', 'string', 0),
    ('company', 'company_email',   'info@prima.example', 'string', 0),
    ('company', 'company_phone',   '', 'string', 0),
    ('company', 'company_address', '', 'string', 0),
    ('company', 'company_website', '', 'string', 0),
    ('company', 'company_logo',    '', 'string', 0),
    ('company', 'vat_number',      '', 'string', 0),
    ('general', 'default_locale',  'en', 'string', 0),
    ('general', 'default_theme',   'light', 'string', 0),
    ('general', 'timezone',        'UTC', 'string', 0),
    ('general', 'currency',        'USD', 'string', 0),
    ('general', 'items_per_page',  '20', 'integer', 0),
    ('general', 'expiring_window',  '30', 'integer', 0),
    ('smtp',    'smtp_host',       '', 'string', 0),
    ('smtp',    'smtp_port',       '587', 'integer', 0),
    ('smtp',    'smtp_user',       '', 'string', 0),
    ('smtp',    'smtp_password',   '', 'string', 1),
    ('smtp',    'smtp_encryption', 'tls', 'string', 0),
    ('smtp',    'smtp_from_email', '', 'string', 0),
    ('smtp',    'smtp_from_name',  'Prima License Manager', 'string', 0),
    ('license', 'license_prefix',  'PLM', 'string', 0),
    ('license', 'default_grace',   '3', 'integer', 0)
ON DUPLICATE KEY UPDATE `value` = `settings`.`value`;

-- ---------------------------------------------------------------------
--  DEMO REFERENCE DATA
-- ---------------------------------------------------------------------
INSERT INTO `products` (`name`, `code`, `description`, `category`, `latest_version`, `status`) VALUES
    ('Prima Accounting', 'PRIMA-ACC', 'Comprehensive accounting and finance suite.', 'Finance', '3.2.0', 'active'),
    ('Prima POS',        'PRIMA-POS', 'Point of sale for retail and restaurants.', 'Retail', '2.5.1', 'active'),
    ('Prima HR',         'PRIMA-HR',  'Human resources and payroll management.', 'HR', '1.8.0', 'active')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `software_versions` (`product_id`, `version_number`, `build_number`, `release_date`, `release_notes`, `status`)
SELECT p.id, '3.2.0', '3200', '2025-01-15', 'Stable release with e-invoicing support.', 'active'
FROM products p WHERE p.code = 'PRIMA-ACC'
ON DUPLICATE KEY UPDATE `build_number` = VALUES(`build_number`);

INSERT INTO `modules` (`product_id`, `name`, `code`, `description`)
SELECT p.id, 'General Ledger', 'GL', 'Core general ledger module.' FROM products p WHERE p.code = 'PRIMA-ACC'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
INSERT INTO `modules` (`product_id`, `name`, `code`, `description`)
SELECT p.id, 'Inventory', 'INV', 'Inventory and stock control.' FROM products p WHERE p.code = 'PRIMA-ACC'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
INSERT INTO `modules` (`product_id`, `name`, `code`, `description`)
SELECT p.id, 'E-Invoicing', 'EINV', 'Electronic invoicing compliance.' FROM products p WHERE p.code = 'PRIMA-ACC'
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `customers` (`company_name`, `contact_person`, `email`, `phone`, `country`, `city`, `status`) VALUES
    ('Acme Trading Co.', 'John Carter', 'john@acme.example', '+1-202-555-0143', 'United States', 'New York', 'active'),
    ('Globex LLC',       'Sara Malik',  'sara@globex.example', '+966-11-555-0110', 'Saudi Arabia', 'Riyadh', 'active')
ON DUPLICATE KEY UPDATE `company_name` = VALUES(`company_name`);
