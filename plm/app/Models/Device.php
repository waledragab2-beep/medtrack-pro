<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Device (activation) model.
 *
 * @package App\Models
 */
final class Device extends BaseModel
{
    protected string $table = 'devices';

    protected array $fillable = [
        'license_id', 'device_name', 'cpu', 'motherboard', 'bios_uuid', 'disk_serial',
        'mac_address', 'windows_sid', 'machine_guid', 'hardware_hash', 'os_info',
        'ip_address', 'status', 'last_check_at', 'deactivated_at',
    ];

    /**
     * @return array<int, array<string, mixed>>
     */
    public function forLicense(int $licenseId): array
    {
        return $this->db->fetchAll(
            'SELECT * FROM devices WHERE license_id = ? ORDER BY activated_at DESC',
            [$licenseId]
        );
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findByHash(int $licenseId, string $hash): ?array
    {
        return $this->db->fetch(
            'SELECT * FROM devices WHERE license_id = ? AND hardware_hash = ? LIMIT 1',
            [$licenseId, $hash]
        );
    }

    public function activeCount(int $licenseId): int
    {
        return (int) $this->db->scalar(
            "SELECT COUNT(*) FROM devices WHERE license_id = ? AND status = 'active'",
            [$licenseId]
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function allWithLicense(int $page, int $perPage): array
    {
        $offset = ($page - 1) * $perPage;
        return $this->db->fetchAll(
            "SELECT d.*, l.license_number, c.company_name AS customer_name
             FROM devices d
             JOIN licenses l ON l.id = d.license_id
             JOIN customers c ON c.id = l.customer_id
             ORDER BY d.activated_at DESC LIMIT {$perPage} OFFSET {$offset}"
        );
    }

    public function touch(int $id, string $ip): void
    {
        $this->db->execute(
            'UPDATE devices SET last_check_at = NOW(), ip_address = ? WHERE id = ?',
            [$ip, $id]
        );
    }
}
