<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Licensable feature module model.
 *
 * @package App\Models
 */
final class Module extends BaseModel
{
    protected string $table = 'modules';

    protected array $fillable = ['product_id', 'name', 'code', 'description'];

    /**
     * @return array<int, array<string, mixed>>
     */
    public function forProduct(int $productId): array
    {
        return $this->db->fetchAll(
            'SELECT * FROM modules WHERE product_id = ? OR product_id IS NULL ORDER BY name',
            [$productId]
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function allList(): array
    {
        return $this->db->fetchAll('SELECT * FROM modules ORDER BY name');
    }
}
