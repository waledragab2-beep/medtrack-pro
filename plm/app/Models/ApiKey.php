<?php

declare(strict_types=1);

namespace App\Models;

/**
 * API key model.
 *
 * @package App\Models
 */
final class ApiKey extends BaseModel
{
    protected string $table = 'api_keys';

    protected array $fillable = [
        'name', 'api_key', 'secret_hash', 'scopes', 'is_active', 'last_used_at', 'created_by',
    ];

    /**
     * @return array<string, mixed>|null
     */
    public function findByKey(string $apiKey): ?array
    {
        return $this->db->fetch(
            'SELECT * FROM api_keys WHERE api_key = ? AND is_active = 1 LIMIT 1',
            [$apiKey]
        );
    }

    public function touch(int $id): void
    {
        $this->db->execute('UPDATE api_keys SET last_used_at = NOW() WHERE id = ?', [$id]);
    }
}
