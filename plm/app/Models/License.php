<?php

declare(strict_types=1);

namespace App\Models;

/**
 * License model with rich query helpers.
 *
 * @package App\Models
 */
final class License extends BaseModel
{
    protected string $table = 'licenses';

    protected array $fillable = [
        'license_number', 'license_key', 'customer_id', 'product_id', 'version_id',
        'type', 'issue_date', 'expire_date', 'users_limit', 'devices_limit',
        'branches_limit', 'modules', 'price', 'currency', 'status', 'notes',
        'signature', 'checksum', 'activation_count', 'created_by',
    ];

    /**
     * @return array<string, mixed>|null
     */
    public function findByKey(string $key): ?array
    {
        return $this->db->fetch('SELECT * FROM licenses WHERE license_key = ? LIMIT 1', [$key]);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function detail(int $id): ?array
    {
        return $this->db->fetch(
            'SELECT l.*, c.company_name AS customer_name, c.email AS customer_email,
                    c.contact_person, p.name AS product_name, p.code AS product_code,
                    sv.version_number
             FROM licenses l
             JOIN customers c ON c.id = l.customer_id
             JOIN products  p ON p.id = l.product_id
             LEFT JOIN software_versions sv ON sv.id = l.version_id
             WHERE l.id = ? LIMIT 1',
            [$id]
        );
    }

    /**
     * Search + paginate with joins.
     *
     * @param array<string, string> $filters
     * @return array{data: array<int, array<string,mixed>>, total: int, page: int, per_page: int, pages: int}
     */
    public function searchDetailed(array $filters, int $page, int $perPage): array
    {
        $where  = '1';
        $params = [];

        if (!empty($filters['term'])) {
            $where  .= ' AND (l.license_number LIKE ? OR l.license_key LIKE ? OR c.company_name LIKE ?)';
            $like    = '%' . $filters['term'] . '%';
            $params  = array_merge($params, [$like, $like, $like]);
        }
        if (!empty($filters['status']) && $filters['status'] !== 'all') {
            $where   .= ' AND l.status = ?';
            $params[] = $filters['status'];
        }
        if (!empty($filters['type']) && $filters['type'] !== 'all') {
            $where   .= ' AND l.type = ?';
            $params[] = $filters['type'];
        }
        if (!empty($filters['customer_id'])) {
            $where   .= ' AND l.customer_id = ?';
            $params[] = (int) $filters['customer_id'];
        }
        if (!empty($filters['product_id'])) {
            $where   .= ' AND l.product_id = ?';
            $params[] = (int) $filters['product_id'];
        }

        $page    = max(1, $page);
        $perPage = max(1, $perPage);
        $offset  = ($page - 1) * $perPage;

        $total = (int) $this->db->scalar(
            "SELECT COUNT(*) FROM licenses l JOIN customers c ON c.id = l.customer_id WHERE {$where}",
            $params
        );

        $rows = $this->db->fetchAll(
            "SELECT l.*, c.company_name AS customer_name, p.name AS product_name
             FROM licenses l
             JOIN customers c ON c.id = l.customer_id
             JOIN products  p ON p.id = l.product_id
             WHERE {$where}
             ORDER BY l.created_at DESC
             LIMIT {$perPage} OFFSET {$offset}",
            $params
        );

        return [
            'data'     => $rows,
            'total'    => $total,
            'page'     => $page,
            'per_page' => $perPage,
            'pages'    => (int) ceil($total / $perPage),
        ];
    }

    /**
     * Licenses expiring within the given number of days.
     *
     * @return array<int, array<string, mixed>>
     */
    public function expiringSoon(int $days = 30): array
    {
        return $this->db->fetchAll(
            "SELECT l.*, c.company_name AS customer_name, p.name AS product_name,
                    DATEDIFF(l.expire_date, CURDATE()) AS days_remaining
             FROM licenses l
             JOIN customers c ON c.id = l.customer_id
             JOIN products  p ON p.id = l.product_id
             WHERE l.status = 'active' AND l.type <> 'lifetime'
               AND l.expire_date IS NOT NULL
               AND l.expire_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
             ORDER BY l.expire_date ASC",
            [$days]
        );
    }

    /**
     * Mark expired licenses whose expiry date has passed.
     */
    public function expireOverdue(): int
    {
        return $this->db->execute(
            "UPDATE licenses SET status = 'expired'
             WHERE status = 'active' AND type <> 'lifetime'
               AND expire_date IS NOT NULL AND expire_date < CURDATE()"
        );
    }

    public function numberExists(string $number): bool
    {
        return (int) $this->db->scalar('SELECT COUNT(*) FROM licenses WHERE license_number = ?', [$number]) > 0;
    }

    public function keyExists(string $key): bool
    {
        return (int) $this->db->scalar('SELECT COUNT(*) FROM licenses WHERE license_key = ?', [$key]) > 0;
    }

    /**
     * Revenue grouped by month for the last N months.
     *
     * @return array<int, array<string, mixed>>
     */
    public function revenueByMonth(int $months = 12): array
    {
        return $this->db->fetchAll(
            "SELECT DATE_FORMAT(issue_date, '%Y-%m') AS ym, SUM(price) AS total, COUNT(*) AS cnt
             FROM licenses
             WHERE issue_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
             GROUP BY ym ORDER BY ym ASC",
            [$months]
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function countByType(): array
    {
        return $this->db->fetchAll(
            'SELECT type, COUNT(*) AS cnt FROM licenses GROUP BY type ORDER BY cnt DESC'
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function countByStatus(): array
    {
        return $this->db->fetchAll(
            'SELECT status, COUNT(*) AS cnt FROM licenses GROUP BY status'
        );
    }
}
