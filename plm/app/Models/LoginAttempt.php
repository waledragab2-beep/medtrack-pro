<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Login attempt model used for rate limiting and security auditing.
 *
 * @package App\Models
 */
final class LoginAttempt extends BaseModel
{
    protected string $table = 'login_attempts';

    protected array $fillable = ['username', 'ip_address', 'success', 'user_agent'];

    public function record(string $username, string $ip, bool $success, string $userAgent): void
    {
        $this->create([
            'username'   => $username,
            'ip_address' => $ip,
            'success'    => $success ? 1 : 0,
            'user_agent' => mb_substr($userAgent, 0, 255),
        ]);
    }

    /**
     * Count failed attempts from an IP within the given window (seconds).
     */
    public function recentFailures(string $ip, int $windowSeconds): int
    {
        return (int) $this->db->scalar(
            'SELECT COUNT(*) FROM login_attempts
             WHERE ip_address = ? AND success = 0
               AND created_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)',
            [$ip, $windowSeconds]
        );
    }

    public function clearFor(string $ip): void
    {
        $this->db->execute('DELETE FROM login_attempts WHERE ip_address = ? AND success = 0', [$ip]);
    }
}
