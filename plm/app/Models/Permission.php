<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Permission model.
 *
 * @package App\Models
 */
final class Permission extends BaseModel
{
    protected string $table = 'permissions';

    protected array $fillable = ['name', 'slug', 'module'];

    /**
     * Resolve permission slugs granted to a role.
     *
     * @return string[]
     */
    public function forRole(int $roleId): array
    {
        $rows = $this->db->fetchAll(
            'SELECT p.slug FROM permissions p
             JOIN role_permission rp ON rp.permission_id = p.id
             WHERE rp.role_id = ?',
            [$roleId]
        );
        return array_map(static fn ($r) => (string) $r['slug'], $rows);
    }

    /**
     * All permissions grouped by module.
     *
     * @return array<string, array<int, array<string, mixed>>>
     */
    public function grouped(): array
    {
        $rows    = $this->db->fetchAll('SELECT * FROM permissions ORDER BY module, id');
        $grouped = [];
        foreach ($rows as $row) {
            $grouped[$row['module']][] = $row;
        }
        return $grouped;
    }
}
