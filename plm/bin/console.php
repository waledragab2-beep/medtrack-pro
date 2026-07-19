<?php

declare(strict_types=1);

/**
 * Prima License Manager — Command Line Console.
 *
 * Usage:
 *   php bin/console.php migrate            Apply pending database migrations
 *   php bin/console.php migrate:status     Show migration status
 *   php bin/console.php seed               Import demo/reference seed data
 *   php bin/console.php backup:db          Create a database backup
 *   php bin/console.php licenses:expire    Mark overdue licenses expired
 *   php bin/console.php notify:renewals    Generate renewal notifications
 *   php bin/console.php keys:generate      Generate RSA key pair (if missing)
 *
 * Intended for shell access and Hostinger cron jobs, e.g.:
 *   php /home/USER/plm/bin/console.php licenses:expire
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("This script may only be run from the command line.\n");
}

require dirname(__DIR__) . '/app/Core/Autoloader.php';

use App\Core\Autoloader;
use App\Core\Database;
use App\Database\Migrator;
use App\Models\License;
use App\Models\Notification;
use App\Services\BackupService;
use App\Services\EncryptionService;

$root = dirname(__DIR__);
$autoloader = new Autoloader();
$autoloader->addNamespace('App\\', $root . '/app');
$autoloader->addNamespace('Prima\\LicenseSDK\\', $root . '/app/LicenseSDK');
$autoloader->register();
require $root . '/app/Helpers/functions.php';

$command = $argv[1] ?? 'help';

/** Print a line to stdout. */
$out = static fn (string $msg = '') => print($msg . PHP_EOL);

try {
    switch ($command) {
        case 'migrate':
            $migrator = new Migrator(Database::instance(), $root . '/database/migrations');
            $run = $migrator->migrate();
            $out($run === [] ? 'Nothing to migrate — database is up to date.' : 'Applied: ' . implode(', ', $run));
            break;

        case 'migrate:status':
            $migrator = new Migrator(Database::instance(), $root . '/database/migrations');
            $status = $migrator->status();
            $out('Applied migrations:');
            foreach ($status['applied'] as $m) {
                $out('  [x] ' . $m);
            }
            $out('Pending migrations:');
            foreach ($status['pending'] as $m) {
                $out('  [ ] ' . $m);
            }
            if ($status['pending'] === []) {
                $out('  (none)');
            }
            break;

        case 'seed':
            $sql = (string) file_get_contents($root . '/database/seeds/seed.sql');
            Database::instance()->pdo()->exec($sql);
            $out('Seed data imported.');
            break;

        case 'backup:db':
            $service  = new BackupService(Database::instance(), new App\Models\Backup());
            $filename = $service->backupDatabase();
            $out('Database backup created: ' . $filename);
            break;

        case 'licenses:expire':
            $licenses = new License();
            $count    = $licenses->expireOverdue();
            $out("Expired {$count} overdue license(s).");
            break;

        case 'notify:renewals':
            $licenses = new License();
            $notify   = new Notification();
            $expiring = $licenses->expiringSoon((int) config('license.expiring_window', 30));
            $created  = 0;
            foreach ($expiring as $lic) {
                $notify->push(
                    'License expiring soon',
                    sprintf('%s (%s) expires in %d days.', $lic['license_number'], $lic['customer_name'], (int) $lic['days_remaining']),
                    'warning',
                    null,
                    url('licenses/' . $lic['id'])
                );
                $created++;
            }
            $out("Generated {$created} renewal notification(s).");
            break;

        case 'keys:generate':
            $crypto = new EncryptionService();
            if ($crypto->keysExist()) {
                $out('Keys already exist. Skipping.');
            } else {
                $crypto->generateKeyPair();
                $out('RSA-4096 key pair generated.');
            }
            break;

        case 'apikey:create':
            $name = $argv[2] ?? 'default';
            $apiKeys = new \App\Models\ApiKey();
            $key    = 'plm_' . bin2hex(random_bytes(16));
            $secret = bin2hex(random_bytes(24));
            $apiKeys->create([
                'name'        => $name,
                'api_key'     => $key,
                'secret_hash' => password_hash($secret, PASSWORD_DEFAULT),
                'scopes'      => json_encode(['licenses:activate', 'licenses:verify', 'licenses:deactivate']),
                'is_active'   => 1,
            ]);
            $out('API key created (store the secret now — it is not shown again):');
            $out('  Name       : ' . $name);
            $out('  X-API-Key  : ' . $key);
            $out('  API Secret : ' . $secret);
            break;

        case 'apikey:list':
            $apiKeys = new \App\Models\ApiKey();
            foreach ($apiKeys->all('id ASC') as $row) {
                $out(sprintf('  #%d  %-20s  %s  %s', $row['id'], $row['name'], $row['api_key'], $row['is_active'] ? 'active' : 'disabled'));
            }
            break;

        case 'help':
        default:
            $out('Prima License Manager Console');
            $out('Usage: php bin/console.php <command>');
            $out('');
            $out('  migrate            Apply pending database migrations');
            $out('  migrate:status     Show migration status');
            $out('  seed               Import seed data');
            $out('  backup:db          Create a database backup');
            $out('  licenses:expire    Mark overdue licenses as expired');
            $out('  notify:renewals    Generate renewal notifications');
            $out('  keys:generate      Generate RSA key pair (if missing)');
            $out('  apikey:create [n]  Create an API key/secret for online integration');
            $out('  apikey:list        List API keys');
            break;
    }
    exit(0);
} catch (\Throwable $e) {
    fwrite(STDERR, 'Error: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
