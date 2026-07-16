<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Product model.
 *
 * @package App\Models
 */
final class Product extends BaseModel
{
    protected string $table = 'products';

    protected array $fillable = [
        'name', 'code', 'description', 'logo', 'category', 'latest_version', 'status',
    ];

    /**
     * @return array<int, array<string, mixed>>
     */
    public function activeList(): array
    {
        return $this->db->fetchAll(
            "SELECT id, name, code, latest_version FROM products WHERE status = 'active' ORDER BY name"
        );
    }

    public function codeExists(string $code, ?int $exceptId = null): bool
    {
        $sql    = 'SELECT COUNT(*) FROM products WHERE code = ?';
        $params = [$code];
        if ($exceptId !== null) {
            $sql     .= ' AND id <> ?';
            $params[] = $exceptId;
        }
        return (int) $this->db->scalar($sql, $params) > 0;
    }

    public function versionCount(int $productId): int
    {
        return (int) $this->db->scalar(
            'SELECT COUNT(*) FROM software_versions WHERE product_id = ?',
            [$productId]
        );
    }

    public function licenseCount(int $productId): int
    {
        return (int) $this->db->scalar(
            'SELECT COUNT(*) FROM licenses WHERE product_id = ?',
            [$productId]
        );
    }
}
