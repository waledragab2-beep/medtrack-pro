<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Activation log model.
 *
 * @package App\Models
 */
final class ActivationLog extends BaseModel
{
    protected string $table = 'activation_logs';

    protected array $fillable = [
        'license_id', 'device_id', 'hardware_hash', 'action', 'result',
        'message', 'ip_address', 'user_agent',
    ];

    /**
     * @return array<int, array<string, mixed>>
     */
    public function recent(int $limit = 20): array
    {
        return $this->db->fetchAll(
            "SELECT al.*, l.license_number
             FROM activation_logs al LEFT JOIN licenses l ON l.id = al.license_id
             ORDER BY al.created_at DESC LIMIT " . (int) $limit
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function forLicense(int $licenseId): array
    {
        return $this->db->fetchAll(
            'SELECT * FROM activation_logs WHERE license_id = ? ORDER BY created_at DESC LIMIT 50',
            [$licenseId]
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function activationsByDay(int $days = 30): array
    {
        return $this->db->fetchAll(
            "SELECT DATE(created_at) AS d, COUNT(*) AS cnt
             FROM activation_logs
             WHERE action = 'activate' AND result = 'success'
               AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
             GROUP BY d ORDER BY d ASC",
            [$days]
        );
    }
}
