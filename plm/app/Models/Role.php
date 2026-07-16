<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Role model with permission assignment helpers.
 *
 * @package App\Models
 */
final class Role extends BaseModel
{
    protected string $table = 'roles';

    protected array $fillable = ['name', 'slug', 'description', 'is_system'];

    /**
     * @return array<int, array<string, mixed>>
     */
    public function allWithCounts(): array
    {
        return $this->db->fetchAll(
            'SELECT r.*,
                (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count,
                (SELECT COUNT(*) FROM role_permission rp WHERE rp.role_id = r.id) AS permission_count
             FROM roles r ORDER BY r.id ASC'
        );
    }

    /**
     * Replace the permission set for a role.
     *
     * @param int[] $permissionIds
     */
    public function syncPermissions(int $roleId, array $permissionIds): void
    {
        $this->db->transaction(function () use ($roleId, $permissionIds): void {
            $this->db->execute('DELETE FROM role_permission WHERE role_id = ?', [$roleId]);
            foreach (array_unique($permissionIds) as $pid) {
                $this->db->execute(
                    'INSERT IGNORE INTO role_permission (role_id, permission_id) VALUES (?, ?)',
                    [$roleId, (int) $pid]
                );
            }
        });
    }

    /**
     * @return int[]
     */
    public function permissionIds(int $roleId): array
    {
        $rows = $this->db->fetchAll(
            'SELECT permission_id FROM role_permission WHERE role_id = ?',
            [$roleId]
        );
        return array_map(static fn ($r) => (int) $r['permission_id'], $rows);
    }
}
