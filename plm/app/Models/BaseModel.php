<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

/**
 * Base model providing common CRUD operations against a single table.
 *
 * Concrete models declare their table name and fillable columns. All queries
 * are parameterised. This is a lightweight active-record-style base, not a
 * full ORM, keeping the footprint suitable for shared hosting.
 *
 * @package App\Models
 */
abstract class BaseModel
{
    protected string $table = '';

    protected string $primaryKey = 'id';

    /** @var string[] Columns permitted for mass assignment. */
    protected array $fillable = [];

    protected Database $db;

    public function __construct(?Database $db = null)
    {
        $this->db = $db ?? Database::instance();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function find(int $id): ?array
    {
        return $this->db->fetch(
            "SELECT * FROM `{$this->table}` WHERE `{$this->primaryKey}` = ? LIMIT 1",
            [$id]
        );
    }

    /**
     * @param array<string, mixed> $conditions
     * @return array<string, mixed>|null
     */
    public function findBy(array $conditions): ?array
    {
        [$where, $params] = $this->buildWhere($conditions);
        return $this->db->fetch(
            "SELECT * FROM `{$this->table}` WHERE {$where} LIMIT 1",
            $params
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function all(string $orderBy = 'id DESC'): array
    {
        return $this->db->fetchAll("SELECT * FROM `{$this->table}` ORDER BY {$orderBy}");
    }

    public function count(string $where = '1', array $params = []): int
    {
        return (int) $this->db->scalar(
            "SELECT COUNT(*) FROM `{$this->table}` WHERE {$where}",
            $params
        );
    }

    /**
     * Insert a record and return its new id.
     *
     * @param array<string, mixed> $data
     */
    public function create(array $data): int
    {
        $data    = $this->filterFillable($data);
        $columns = array_keys($data);
        $place   = array_map(static fn ($c) => ':' . $c, $columns);

        $sql = sprintf(
            'INSERT INTO `%s` (`%s`) VALUES (%s)',
            $this->table,
            implode('`, `', $columns),
            implode(', ', $place)
        );

        $this->db->query($sql, $this->bindify($data));
        return $this->db->lastInsertId();
    }

    /**
     * Update a record by primary key.
     *
     * @param array<string, mixed> $data
     */
    public function update(int $id, array $data): int
    {
        $data = $this->filterFillable($data);
        if ($data === []) {
            return 0;
        }

        $set = [];
        foreach (array_keys($data) as $column) {
            $set[] = "`{$column}` = :{$column}";
        }

        $params       = $this->bindify($data);
        $params['id'] = $id;

        $sql = sprintf(
            'UPDATE `%s` SET %s WHERE `%s` = :id',
            $this->table,
            implode(', ', $set),
            $this->primaryKey
        );

        return $this->db->execute($sql, $params);
    }

    public function delete(int $id): int
    {
        return $this->db->execute(
            "DELETE FROM `{$this->table}` WHERE `{$this->primaryKey}` = ?",
            [$id]
        );
    }

    /**
     * Paginate results with optional filtering.
     *
     * @param array<string|int, mixed> $params
     * @return array{data: array<int, array<string,mixed>>, total: int, page: int, per_page: int, pages: int}
     */
    public function paginate(
        int $page = 1,
        int $perPage = 20,
        string $where = '1',
        array $params = [],
        string $orderBy = 'id DESC',
        string $select = '*'
    ): array {
        $page    = max(1, $page);
        $perPage = max(1, $perPage);
        $offset  = ($page - 1) * $perPage;

        $total = (int) $this->db->scalar(
            "SELECT COUNT(*) FROM `{$this->table}` WHERE {$where}",
            $params
        );

        $rows = $this->db->fetchAll(
            "SELECT {$select} FROM `{$this->table}` WHERE {$where} ORDER BY {$orderBy} LIMIT {$perPage} OFFSET {$offset}",
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
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    protected function filterFillable(array $data): array
    {
        if ($this->fillable === []) {
            return $data;
        }
        return array_intersect_key($data, array_flip($this->fillable));
    }

    /**
     * Prefix keys with ':' for named-parameter binding.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    protected function bindify(array $data): array
    {
        $bound = [];
        foreach ($data as $key => $value) {
            $bound[':' . $key] = $value;
        }
        return $bound;
    }

    /**
     * Build an AND-joined WHERE clause from an associative array.
     *
     * @param array<string, mixed> $conditions
     * @return array{0:string, 1:array<int, mixed>}
     */
    protected function buildWhere(array $conditions): array
    {
        $clauses = [];
        $params  = [];
        foreach ($conditions as $column => $value) {
            $clauses[] = "`{$column}` = ?";
            $params[]  = $value;
        }
        return [implode(' AND ', $clauses) ?: '1', $params];
    }

    public function db(): Database
    {
        return $this->db;
    }

    public function table(): string
    {
        return $this->table;
    }
}
