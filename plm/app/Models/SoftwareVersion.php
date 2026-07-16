<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Software version model.
 *
 * @package App\Models
 */
final class SoftwareVersion extends BaseModel
{
    protected string $table = 'software_versions';

    protected array $fillable = [
        'product_id', 'version_number', 'build_number', 'release_date',
        'release_notes', 'min_supported_license', 'compatibility', 'download_url', 'status',
    ];

    /**
     * @return array<int, array<string, mixed>>
     */
    public function forProduct(int $productId): array
    {
        return $this->db->fetchAll(
            'SELECT * FROM software_versions WHERE product_id = ? ORDER BY release_date DESC, id DESC',
            [$productId]
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function allWithProduct(): array
    {
        return $this->db->fetchAll(
            'SELECT sv.*, p.name AS product_name, p.code AS product_code
             FROM software_versions sv JOIN products p ON p.id = sv.product_id
             ORDER BY sv.release_date DESC, sv.id DESC'
        );
    }
}
