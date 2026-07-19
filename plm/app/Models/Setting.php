<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Settings model with key/value access and in-request caching.
 *
 * @package App\Models
 */
final class Setting extends BaseModel
{
    protected string $table = 'settings';

    protected array $fillable = ['group_name', 'key_name', 'value', 'type', 'is_secret'];

    /** @var array<string, mixed>|null */
    private ?array $cache = null;

    /**
     * Load all settings into a flat key/value map.
     *
     * @return array<string, mixed>
     */
    public function allMap(): array
    {
        if ($this->cache !== null) {
            return $this->cache;
        }

        $rows = $this->db->fetchAll('SELECT key_name, value, type FROM settings');
        $map  = [];
        foreach ($rows as $row) {
            $map[$row['key_name']] = $this->cast($row['value'], $row['type']);
        }
        return $this->cache = $map;
    }

    public function get(string $key, mixed $default = null): mixed
    {
        $map = $this->allMap();
        return $map[$key] ?? $default;
    }

    public function set(string $key, mixed $value, string $group = 'general', string $type = 'string'): void
    {
        $this->db->execute(
            'INSERT INTO settings (group_name, key_name, value, type)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE value = VALUES(value), type = VALUES(type)',
            [$group, $key, (string) $value, $type]
        );
        $this->cache = null;
    }

    /**
     * Bulk update settings.
     *
     * @param array<string, mixed> $values
     */
    public function updateMany(array $values): void
    {
        $this->db->transaction(function () use ($values): void {
            foreach ($values as $key => $value) {
                $this->db->execute(
                    'UPDATE settings SET value = ? WHERE key_name = ?',
                    [is_bool($value) ? ($value ? '1' : '0') : (string) $value, $key]
                );
            }
        });
        $this->cache = null;
    }

    /**
     * @return array<string, array<int, array<string, mixed>>>
     */
    public function grouped(): array
    {
        $rows    = $this->db->fetchAll('SELECT * FROM settings ORDER BY group_name, id');
        $grouped = [];
        foreach ($rows as $row) {
            $grouped[$row['group_name']][] = $row;
        }
        return $grouped;
    }

    private function cast(mixed $value, string $type): mixed
    {
        return match ($type) {
            'integer' => (int) $value,
            'boolean' => (bool) $value,
            'float'   => (float) $value,
            'json'    => json_decode((string) $value, true),
            default   => $value,
        };
    }
}
