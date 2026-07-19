<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Backup registry model.
 *
 * @package App\Models
 */
final class Backup extends BaseModel
{
    protected string $table = 'backups';

    protected array $fillable = ['filename', 'type', 'size_bytes', 'created_by'];

    /**
     * @return array<int, array<string, mixed>>
     */
    public function allWithUser(): array
    {
        return $this->db->fetchAll(
            'SELECT b.*, u.name AS created_by_name
             FROM backups b LEFT JOIN users u ON u.id = b.created_by
             ORDER BY b.created_at DESC'
        );
    }
}
