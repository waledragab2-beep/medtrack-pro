<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Models\Backup;
use RuntimeException;

/**
 * Database and file backup service.
 *
 * Produces portable SQL dumps using pure PHP (no shell dependency, so it works
 * on restricted shared hosting) and can archive application files into a zip.
 *
 * @package App\Services
 */
final class BackupService
{
    private string $backupDir;

    public function __construct(private Database $db, private Backup $backups)
    {
        $this->backupDir = (string) config('paths.backups');
        if (!is_dir($this->backupDir)) {
            @mkdir($this->backupDir, 0775, true);
        }
    }

    /**
     * Create a SQL dump of all tables.
     */
    public function backupDatabase(?int $userId = null): string
    {
        $filename = 'db-backup-' . date('Ymd-His') . '.sql';
        $path     = $this->backupDir . '/' . $filename;

        $handle = fopen($path, 'wb');
        if ($handle === false) {
            throw new RuntimeException('Unable to create backup file.');
        }

        fwrite($handle, "-- PLM Database Backup\n-- Generated: " . date('c') . "\n");
        fwrite($handle, "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n\n");

        $tables = $this->db->fetchAll('SHOW TABLES');
        foreach ($tables as $row) {
            $table = (string) array_values($row)[0];
            $this->dumpTable($handle, $table);
        }

        fwrite($handle, "\nSET FOREIGN_KEY_CHECKS=1;\n");
        fclose($handle);

        $this->backups->create([
            'filename'   => $filename,
            'type'       => 'database',
            'size_bytes' => (int) filesize($path),
            'created_by' => $userId,
        ]);

        return $filename;
    }

    /**
     * @param resource $handle
     */
    private function dumpTable($handle, string $table): void
    {
        // Skip views — they are recreated by schema, not data.
        $createRow = $this->db->fetch("SHOW CREATE TABLE `{$table}`");
        if ($createRow === null || !isset($createRow['Create Table'])) {
            return;
        }

        fwrite($handle, "DROP TABLE IF EXISTS `{$table}`;\n");
        fwrite($handle, $createRow['Create Table'] . ";\n\n");

        $rows = $this->db->fetchAll("SELECT * FROM `{$table}`");
        foreach ($rows as $row) {
            $columns = array_map(static fn ($c) => "`{$c}`", array_keys($row));
            $values  = array_map(function ($v) {
                if ($v === null) {
                    return 'NULL';
                }
                return $this->db->pdo()->quote((string) $v);
            }, array_values($row));

            fwrite(
                $handle,
                "INSERT INTO `{$table}` (" . implode(', ', $columns) . ') VALUES (' . implode(', ', $values) . ");\n"
            );
        }
        fwrite($handle, "\n");
    }

    /**
     * Archive application storage/uploads into a zip file.
     */
    public function backupFiles(?int $userId = null): string
    {
        if (!class_exists('ZipArchive')) {
            throw new RuntimeException('The zip extension is required for file backups.');
        }

        $filename = 'files-backup-' . date('Ymd-His') . '.zip';
        $path     = $this->backupDir . '/' . $filename;
        $zip      = new \ZipArchive();

        if ($zip->open($path, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Unable to create zip archive.');
        }

        $source = (string) config('paths.uploads');
        $this->addDirToZip($zip, $source, 'uploads');
        $zip->close();

        $this->backups->create([
            'filename'   => $filename,
            'type'       => 'files',
            'size_bytes' => (int) filesize($path),
            'created_by' => $userId,
        ]);

        return $filename;
    }

    private function addDirToZip(\ZipArchive $zip, string $dir, string $prefix): void
    {
        if (!is_dir($dir)) {
            return;
        }
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS)
        );
        foreach ($iterator as $file) {
            /** @var \SplFileInfo $file */
            if ($file->isFile()) {
                $local = $prefix . '/' . substr($file->getPathname(), strlen($dir) + 1);
                $zip->addFile($file->getPathname(), $local);
            }
        }
    }

    /**
     * Restore the database from an uploaded SQL dump.
     */
    public function restoreDatabase(string $filePath): int
    {
        if (!is_readable($filePath)) {
            throw new RuntimeException('Backup file is not readable.');
        }

        $sql        = (string) file_get_contents($filePath);
        $statements = $this->splitStatements($sql);
        $executed   = 0;

        $this->db->pdo()->exec('SET FOREIGN_KEY_CHECKS=0');
        foreach ($statements as $statement) {
            $statement = trim($statement);
            if ($statement === '' || str_starts_with($statement, '--')) {
                continue;
            }
            $this->db->pdo()->exec($statement);
            $executed++;
        }
        $this->db->pdo()->exec('SET FOREIGN_KEY_CHECKS=1');

        return $executed;
    }

    /**
     * @return string[]
     */
    private function splitStatements(string $sql): array
    {
        // Split on semicolons at line ends, respecting quoted strings.
        $statements = [];
        $buffer     = '';
        $inString   = false;
        $stringChar = '';
        $len        = strlen($sql);

        for ($i = 0; $i < $len; $i++) {
            $char = $sql[$i];
            $buffer .= $char;

            if ($inString) {
                if ($char === $stringChar && ($i === 0 || $sql[$i - 1] !== '\\')) {
                    $inString = false;
                }
            } elseif ($char === "'" || $char === '"') {
                $inString   = true;
                $stringChar = $char;
            } elseif ($char === ';') {
                $statements[] = $buffer;
                $buffer       = '';
            }
        }

        if (trim($buffer) !== '') {
            $statements[] = $buffer;
        }

        return $statements;
    }

    public function path(string $filename): string
    {
        return $this->backupDir . '/' . basename($filename);
    }

    public function delete(string $filename): void
    {
        $path = $this->path($filename);
        if (is_file($path)) {
            @unlink($path);
        }
        $this->db->execute('DELETE FROM backups WHERE filename = ?', [basename($filename)]);
    }
}
