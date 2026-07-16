<?php

declare(strict_types=1);

namespace App\Database;

use App\Core\Database;

/**
 * Simple, forward-only migration runner.
 *
 * Applies `.sql` files from database/migrations in filename order, recording
 * each applied file in a `schema_migrations` table so it runs only once.
 * Designed to work on shared hosting via the CLI console or the installer.
 *
 * @package App\Database
 */
final class Migrator
{
    public function __construct(private Database $db, private string $migrationsPath)
    {
    }

    /**
     * Ensure the migrations tracking table exists.
     */
    private function ensureTable(): void
    {
        $this->db->pdo()->exec(
            'CREATE TABLE IF NOT EXISTS `schema_migrations` (
                `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
                `migration` VARCHAR(191) NOT NULL,
                `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                UNIQUE KEY `uq_migration` (`migration`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }

    /**
     * @return string[] Names of migrations already applied.
     */
    private function applied(): array
    {
        $rows = $this->db->fetchAll('SELECT migration FROM schema_migrations ORDER BY migration');
        return array_map(static fn ($r) => (string) $r['migration'], $rows);
    }

    /**
     * Run all pending migrations.
     *
     * @return string[] Names of migrations applied in this run.
     */
    public function migrate(): array
    {
        $this->ensureTable();
        $applied = $this->applied();
        $files   = glob($this->migrationsPath . '/*.sql') ?: [];
        sort($files);

        $run = [];
        foreach ($files as $file) {
            $name = basename($file);
            if (in_array($name, $applied, true)) {
                continue;
            }

            $sql = (string) file_get_contents($file);
            $this->db->pdo()->exec('SET FOREIGN_KEY_CHECKS=0');
            $this->db->pdo()->exec($sql);
            $this->db->pdo()->exec('SET FOREIGN_KEY_CHECKS=1');

            $this->db->execute('INSERT INTO schema_migrations (migration) VALUES (?)', [$name]);
            $run[] = $name;
        }

        return $run;
    }

    /**
     * @return array{applied: string[], pending: string[]}
     */
    public function status(): array
    {
        $this->ensureTable();
        $applied = $this->applied();
        $files   = array_map('basename', glob($this->migrationsPath . '/*.sql') ?: []);
        sort($files);

        return [
            'applied' => $applied,
            'pending' => array_values(array_diff($files, $applied)),
        ];
    }
}
