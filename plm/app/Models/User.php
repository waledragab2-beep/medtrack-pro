<?php

declare(strict_types=1);

namespace App\Models;

/**
 * User model.
 *
 * @package App\Models
 */
final class User extends BaseModel
{
    protected string $table = 'users';

    protected array $fillable = [
        'role_id', 'name', 'username', 'email', 'password_hash', 'phone',
        'avatar', 'locale', 'theme', 'two_factor_secret', 'two_factor_enabled',
        'is_active', 'last_login_at', 'last_login_ip', 'failed_attempts', 'locked_until',
    ];

    /**
     * @return array<string, mixed>|null
     */
    public function findByUsernameOrEmail(string $identifier): ?array
    {
        return $this->db->fetch(
            'SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1',
            [$identifier, $identifier]
        );
    }

    /**
     * Fetch a user joined with role metadata.
     *
     * @return array<string, mixed>|null
     */
    public function findWithRole(int $id): ?array
    {
        return $this->db->fetch(
            'SELECT u.*, r.name AS role_name, r.slug AS role_slug
             FROM users u JOIN roles r ON r.id = u.role_id
             WHERE u.id = ? LIMIT 1',
            [$id]
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function allWithRoles(): array
    {
        return $this->db->fetchAll(
            'SELECT u.*, r.name AS role_name, r.slug AS role_slug
             FROM users u JOIN roles r ON r.id = u.role_id
             ORDER BY u.id DESC'
        );
    }

    public function updatePassword(int $id, string $plainPassword): void
    {
        $hash = password_hash(
            $plainPassword,
            config('security.password_algo'),
            config('security.password_options')
        );
        $this->db->execute('UPDATE users SET password_hash = ? WHERE id = ?', [$hash, $id]);
    }

    public function recordLogin(int $id, string $ip): void
    {
        $this->db->execute(
            'UPDATE users SET last_login_at = NOW(), last_login_ip = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?',
            [$ip, $id]
        );
    }

    public function incrementFailed(int $id): void
    {
        $this->db->execute('UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = ?', [$id]);
    }

    public function lock(int $id, int $seconds): void
    {
        $this->db->execute(
            'UPDATE users SET locked_until = DATE_ADD(NOW(), INTERVAL ? SECOND) WHERE id = ?',
            [$seconds, $id]
        );
    }

    public function usernameExists(string $username, ?int $exceptId = null): bool
    {
        $sql    = 'SELECT COUNT(*) FROM users WHERE username = ?';
        $params = [$username];
        if ($exceptId !== null) {
            $sql     .= ' AND id <> ?';
            $params[] = $exceptId;
        }
        return (int) $this->db->scalar($sql, $params) > 0;
    }

    public function emailExists(string $email, ?int $exceptId = null): bool
    {
        $sql    = 'SELECT COUNT(*) FROM users WHERE email = ?';
        $params = [$email];
        if ($exceptId !== null) {
            $sql     .= ' AND id <> ?';
            $params[] = $exceptId;
        }
        return (int) $this->db->scalar($sql, $params) > 0;
    }
}
