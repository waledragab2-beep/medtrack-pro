<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Audit log model.
 *
 * @package App\Models
 */
final class AuditLog extends BaseModel
{
    protected string $table = 'audit_logs';

    protected array $fillable = [
        'user_id', 'action', 'entity', 'entity_id', 'description',
        'old_values', 'new_values', 'ip_address', 'user_agent',
    ];

    /**
     * Search + paginate audit entries with user names.
     *
     * @return array{data: array<int, array<string,mixed>>, total: int, page: int, per_page: int, pages: int}
     */
    public function search(string $term, string $action, int $page, int $perPage): array
    {
        $where  = '1';
        $params = [];

        if ($term !== '') {
            $where  .= ' AND (a.description LIKE ? OR a.entity LIKE ?)';
            $like    = '%' . $term . '%';
            $params  = array_merge($params, [$like, $like]);
        }
        if ($action !== '' && $action !== 'all') {
            $where   .= ' AND a.action = ?';
            $params[] = $action;
        }

        $offset = (max(1, $page) - 1) * $perPage;

        $total = (int) $this->db->scalar(
            "SELECT COUNT(*) FROM audit_logs a WHERE {$where}",
            $params
        );

        $rows = $this->db->fetchAll(
            "SELECT a.*, u.name AS user_name
             FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
             WHERE {$where}
             ORDER BY a.created_at DESC LIMIT {$perPage} OFFSET {$offset}",
            $params
        );

        return [
            'data'     => $rows,
            'total'    => $total,
            'page'     => max(1, $page),
            'per_page' => $perPage,
            'pages'    => (int) ceil($total / $perPage),
        ];
    }

    /**
     * @return string[]
     */
    public function distinctActions(): array
    {
        $rows = $this->db->fetchAll('SELECT DISTINCT action FROM audit_logs ORDER BY action');
        return array_map(static fn ($r) => (string) $r['action'], $rows);
    }
}
