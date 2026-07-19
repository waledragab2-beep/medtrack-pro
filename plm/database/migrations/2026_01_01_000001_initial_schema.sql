-- =====================================================================
--  Prima License Manager (PLM) — Database Schema
--  Engine: MySQL 8.0+  |  Charset: utf8mb4  |  Collation: utf8mb4_unicode_ci
--  Version: 1.0.0
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ---------------------------------------------------------------------
--  ROLES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `roles` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name`        VARCHAR(80) NOT NULL,
    `slug`        VARCHAR(80) NOT NULL,
    `description` VARCHAR(255) DEFAULT NULL,
    `is_system`   TINYINT(1) NOT NULL DEFAULT 0,
    `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_roles_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  PERMISSIONS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `permissions` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name`        VARCHAR(100) NOT NULL,
    `slug`        VARCHAR(100) NOT NULL,
    `module`      VARCHAR(60) NOT NULL,
    `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_permissions_slug` (`slug`),
    KEY `ix_permissions_module` (`module`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  ROLE_PERMISSION (pivot)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `role_permission` (
    `role_id`       INT UNSIGNED NOT NULL,
    `permission_id` INT UNSIGNED NOT NULL,
    PRIMARY KEY (`role_id`, `permission_id`),
    KEY `ix_rp_permission` (`permission_id`),
    CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_rp_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  USERS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
    `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `role_id`          INT UNSIGNED NOT NULL,
    `name`             VARCHAR(120) NOT NULL,
    `username`         VARCHAR(60) NOT NULL,
    `email`            VARCHAR(160) NOT NULL,
    `password_hash`    VARCHAR(255) NOT NULL,
    `phone`            VARCHAR(40) DEFAULT NULL,
    `avatar`           VARCHAR(255) DEFAULT NULL,
    `locale`           VARCHAR(5) NOT NULL DEFAULT 'en',
    `theme`            VARCHAR(10) NOT NULL DEFAULT 'light',
    `two_factor_secret` VARCHAR(255) DEFAULT NULL,
    `two_factor_enabled` TINYINT(1) NOT NULL DEFAULT 0,
    `is_active`        TINYINT(1) NOT NULL DEFAULT 1,
    `last_login_at`    TIMESTAMP NULL DEFAULT NULL,
    `last_login_ip`    VARCHAR(45) DEFAULT NULL,
    `failed_attempts`  INT UNSIGNED NOT NULL DEFAULT 0,
    `locked_until`     TIMESTAMP NULL DEFAULT NULL,
    `created_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_username` (`username`),
    UNIQUE KEY `uq_users_email` (`email`),
    KEY `ix_users_role` (`role_id`),
    CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  CUSTOMERS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customers` (
    `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `company_name`     VARCHAR(180) NOT NULL,
    `contact_person`   VARCHAR(120) DEFAULT NULL,
    `phone`            VARCHAR(40) DEFAULT NULL,
    `mobile`           VARCHAR(40) DEFAULT NULL,
    `email`            VARCHAR(160) DEFAULT NULL,
    `website`          VARCHAR(180) DEFAULT NULL,
    `country`          VARCHAR(80) DEFAULT NULL,
    `city`             VARCHAR(80) DEFAULT NULL,
    `address`          VARCHAR(255) DEFAULT NULL,
    `vat_number`       VARCHAR(60) DEFAULT NULL,
    `commercial_reg`   VARCHAR(60) DEFAULT NULL,
    `notes`            TEXT DEFAULT NULL,
    `status`           ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
    `created_by`       INT UNSIGNED DEFAULT NULL,
    `created_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `ix_customers_status` (`status`),
    KEY `ix_customers_company` (`company_name`),
    KEY `ix_customers_creator` (`created_by`),
    CONSTRAINT `fk_customers_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  PRODUCTS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `products` (
    `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name`             VARCHAR(160) NOT NULL,
    `code`             VARCHAR(60) NOT NULL,
    `description`      TEXT DEFAULT NULL,
    `logo`             VARCHAR(255) DEFAULT NULL,
    `category`         VARCHAR(80) DEFAULT NULL,
    `latest_version`   VARCHAR(40) DEFAULT NULL,
    `status`           ENUM('active','inactive') NOT NULL DEFAULT 'active',
    `created_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_products_code` (`code`),
    KEY `ix_products_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  SOFTWARE VERSIONS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `software_versions` (
    `id`                     INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `product_id`             INT UNSIGNED NOT NULL,
    `version_number`         VARCHAR(40) NOT NULL,
    `build_number`           VARCHAR(40) DEFAULT NULL,
    `release_date`           DATE DEFAULT NULL,
    `release_notes`          TEXT DEFAULT NULL,
    `min_supported_license`  VARCHAR(40) DEFAULT NULL,
    `compatibility`          VARCHAR(180) DEFAULT NULL,
    `download_url`           VARCHAR(255) DEFAULT NULL,
    `status`                 ENUM('active','deprecated','beta') NOT NULL DEFAULT 'active',
    `created_at`             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_version_per_product` (`product_id`, `version_number`),
    KEY `ix_versions_product` (`product_id`),
    CONSTRAINT `fk_versions_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  MODULES (feature modules that can be licensed)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `modules` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `product_id`  INT UNSIGNED DEFAULT NULL,
    `name`        VARCHAR(120) NOT NULL,
    `code`        VARCHAR(60) NOT NULL,
    `description` VARCHAR(255) DEFAULT NULL,
    `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_modules_code` (`code`),
    KEY `ix_modules_product` (`product_id`),
    CONSTRAINT `fk_modules_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  LICENSES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `licenses` (
    `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `license_number`   VARCHAR(40) NOT NULL,
    `license_key`      VARCHAR(120) NOT NULL,
    `customer_id`      INT UNSIGNED NOT NULL,
    `product_id`       INT UNSIGNED NOT NULL,
    `version_id`       INT UNSIGNED DEFAULT NULL,
    `type`             ENUM('trial','monthly','quarterly','semi_annual','yearly','lifetime','developer','enterprise') NOT NULL DEFAULT 'trial',
    `issue_date`       DATE NOT NULL,
    `expire_date`      DATE DEFAULT NULL,
    `users_limit`      INT UNSIGNED NOT NULL DEFAULT 1,
    `devices_limit`    INT UNSIGNED NOT NULL DEFAULT 1,
    `branches_limit`   INT UNSIGNED NOT NULL DEFAULT 1,
    `modules`          JSON DEFAULT NULL,
    `price`            DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `currency`         VARCHAR(8) NOT NULL DEFAULT 'USD',
    `status`           ENUM('active','expired','suspended','revoked','pending') NOT NULL DEFAULT 'active',
    `notes`            TEXT DEFAULT NULL,
    `signature`        TEXT DEFAULT NULL,
    `checksum`         VARCHAR(64) DEFAULT NULL,
    `activation_count` INT UNSIGNED NOT NULL DEFAULT 0,
    `created_by`       INT UNSIGNED DEFAULT NULL,
    `created_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_licenses_number` (`license_number`),
    UNIQUE KEY `uq_licenses_key` (`license_key`),
    KEY `ix_licenses_customer` (`customer_id`),
    KEY `ix_licenses_product` (`product_id`),
    KEY `ix_licenses_version` (`version_id`),
    KEY `ix_licenses_status` (`status`),
    KEY `ix_licenses_expire` (`expire_date`),
    CONSTRAINT `fk_licenses_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_licenses_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_licenses_version` FOREIGN KEY (`version_id`) REFERENCES `software_versions` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_licenses_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  DEVICES (activations)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `devices` (
    `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `license_id`       INT UNSIGNED NOT NULL,
    `device_name`      VARCHAR(160) DEFAULT NULL,
    `cpu`              VARCHAR(180) DEFAULT NULL,
    `motherboard`      VARCHAR(180) DEFAULT NULL,
    `bios_uuid`        VARCHAR(120) DEFAULT NULL,
    `disk_serial`      VARCHAR(120) DEFAULT NULL,
    `mac_address`      VARCHAR(60) DEFAULT NULL,
    `windows_sid`      VARCHAR(120) DEFAULT NULL,
    `machine_guid`     VARCHAR(120) DEFAULT NULL,
    `hardware_hash`    VARCHAR(64) NOT NULL,
    `os_info`          VARCHAR(180) DEFAULT NULL,
    `ip_address`       VARCHAR(45) DEFAULT NULL,
    `status`           ENUM('active','blocked','deactivated') NOT NULL DEFAULT 'active',
    `activated_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `last_check_at`    TIMESTAMP NULL DEFAULT NULL,
    `deactivated_at`   TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_device_per_license` (`license_id`, `hardware_hash`),
    KEY `ix_devices_license` (`license_id`),
    KEY `ix_devices_hash` (`hardware_hash`),
    CONSTRAINT `fk_devices_license` FOREIGN KEY (`license_id`) REFERENCES `licenses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  ACTIVATION LOG
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `activation_logs` (
    `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `license_id`     INT UNSIGNED DEFAULT NULL,
    `device_id`      INT UNSIGNED DEFAULT NULL,
    `hardware_hash`  VARCHAR(64) DEFAULT NULL,
    `action`         ENUM('activate','deactivate','verify','reject') NOT NULL,
    `result`         ENUM('success','failed') NOT NULL,
    `message`        VARCHAR(255) DEFAULT NULL,
    `ip_address`     VARCHAR(45) DEFAULT NULL,
    `user_agent`     VARCHAR(255) DEFAULT NULL,
    `created_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `ix_actlog_license` (`license_id`),
    KEY `ix_actlog_created` (`created_at`),
    CONSTRAINT `fk_actlog_license` FOREIGN KEY (`license_id`) REFERENCES `licenses` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_actlog_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  AUDIT LOGS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`      INT UNSIGNED DEFAULT NULL,
    `action`       VARCHAR(80) NOT NULL,
    `entity`       VARCHAR(80) DEFAULT NULL,
    `entity_id`    INT UNSIGNED DEFAULT NULL,
    `description`  VARCHAR(255) DEFAULT NULL,
    `old_values`   JSON DEFAULT NULL,
    `new_values`   JSON DEFAULT NULL,
    `ip_address`   VARCHAR(45) DEFAULT NULL,
    `user_agent`   VARCHAR(255) DEFAULT NULL,
    `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `ix_audit_user` (`user_id`),
    KEY `ix_audit_entity` (`entity`, `entity_id`),
    KEY `ix_audit_created` (`created_at`),
    CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  LOGIN ATTEMPTS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `login_attempts` (
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `username`    VARCHAR(120) DEFAULT NULL,
    `ip_address`  VARCHAR(45) NOT NULL,
    `success`     TINYINT(1) NOT NULL DEFAULT 0,
    `user_agent`  VARCHAR(255) DEFAULT NULL,
    `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `ix_login_ip` (`ip_address`),
    KEY `ix_login_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  NOTIFICATIONS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`     INT UNSIGNED DEFAULT NULL,
    `type`        VARCHAR(60) NOT NULL DEFAULT 'info',
    `title`       VARCHAR(160) NOT NULL,
    `message`     VARCHAR(500) DEFAULT NULL,
    `link`        VARCHAR(255) DEFAULT NULL,
    `is_read`     TINYINT(1) NOT NULL DEFAULT 0,
    `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `ix_notif_user` (`user_id`, `is_read`),
    CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  SETTINGS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `settings` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `group_name`  VARCHAR(60) NOT NULL DEFAULT 'general',
    `key_name`    VARCHAR(80) NOT NULL,
    `value`       TEXT DEFAULT NULL,
    `type`        VARCHAR(20) NOT NULL DEFAULT 'string',
    `is_secret`   TINYINT(1) NOT NULL DEFAULT 0,
    `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_settings_key` (`key_name`),
    KEY `ix_settings_group` (`group_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  API KEYS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `api_keys` (
    `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name`         VARCHAR(120) NOT NULL,
    `api_key`      VARCHAR(64) NOT NULL,
    `secret_hash`  VARCHAR(255) NOT NULL,
    `scopes`       JSON DEFAULT NULL,
    `is_active`    TINYINT(1) NOT NULL DEFAULT 1,
    `last_used_at` TIMESTAMP NULL DEFAULT NULL,
    `created_by`   INT UNSIGNED DEFAULT NULL,
    `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_apikeys_key` (`api_key`),
    CONSTRAINT `fk_apikeys_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  BACKUPS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `backups` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `filename`    VARCHAR(180) NOT NULL,
    `type`        ENUM('database','files','full') NOT NULL DEFAULT 'database',
    `size_bytes`  BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `created_by`  INT UNSIGNED DEFAULT NULL,
    `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_backups_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
--  VIEWS
-- =====================================================================
CREATE OR REPLACE VIEW `v_license_details` AS
SELECT
    l.id,
    l.license_number,
    l.license_key,
    l.type,
    l.issue_date,
    l.expire_date,
    l.status,
    l.price,
    l.currency,
    l.users_limit,
    l.devices_limit,
    l.activation_count,
    c.id           AS customer_id,
    c.company_name AS customer_name,
    p.id           AS product_id,
    p.name         AS product_name,
    p.code         AS product_code,
    sv.version_number,
    CASE
        WHEN l.type = 'lifetime' THEN NULL
        ELSE DATEDIFF(l.expire_date, CURDATE())
    END AS days_remaining
FROM licenses l
JOIN customers c ON c.id = l.customer_id
JOIN products  p ON p.id = l.product_id
LEFT JOIN software_versions sv ON sv.id = l.version_id;

CREATE OR REPLACE VIEW `v_dashboard_stats` AS
SELECT
    (SELECT COUNT(*) FROM customers WHERE status = 'active')                              AS active_customers,
    (SELECT COUNT(*) FROM products  WHERE status = 'active')                              AS active_products,
    (SELECT COUNT(*) FROM licenses  WHERE status = 'active')                              AS active_licenses,
    (SELECT COUNT(*) FROM licenses  WHERE status = 'expired')                             AS expired_licenses,
    (SELECT COUNT(*) FROM licenses  WHERE status = 'active' AND type <> 'lifetime'
        AND expire_date IS NOT NULL AND expire_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)) AS expiring_soon,
    (SELECT COUNT(*) FROM devices   WHERE status = 'active')                              AS active_devices,
    (SELECT COALESCE(SUM(price),0) FROM licenses WHERE status IN ('active','expired'))    AS total_revenue;

SET FOREIGN_KEY_CHECKS = 1;
