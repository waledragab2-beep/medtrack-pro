<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Customer model.
 *
 * @package App\Models
 */
final class Customer extends BaseModel
{
    protected string $table = 'customers';

    protected array $fillable = [
        'company_name', 'contact_person', 'phone', 'mobile', 'email', 'website',
        'country', 'city', 'address', 'vat_number', 'commercial_reg', 'notes',
        'status', 'created_by',
    ];

    /**
     * Search + paginate customers.
     *
     * @return array{data: array<int, array<string,mixed>>, total: int, page: int, per_page: int, pages: int}
     */
    public function search(string $term, string $status, int $page, int $perPage): array
    {
        $where  = '1';
        $params = [];

        if ($term !== '') {
            $where   .= ' AND (company_name LIKE ? OR contact_person LIKE ? OR email LIKE ? OR phone LIKE ?)';
            $like     = '%' . $term . '%';
            $params   = array_merge($params, [$like, $like, $like, $like]);
        }
        if ($status !== '' && $status !== 'all') {
            $where   .= ' AND status = ?';
            $params[] = $status;
        }

        return $this->paginate($page, $perPage, $where, $params, 'created_at DESC');
    }

    public function licenseCount(int $customerId): int
    {
        return (int) $this->db->scalar(
            'SELECT COUNT(*) FROM licenses WHERE customer_id = ?',
            [$customerId]
        );
    }
}
