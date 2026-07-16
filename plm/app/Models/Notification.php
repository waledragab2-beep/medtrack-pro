<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Notification model.
 *
 * @package App\Models
 */
final class Notification extends BaseModel
{
    protected string $table = 'notifications';

    protected array $fillable = ['user_id', 'type', 'title', 'message', 'link', 'is_read'];

    /**
     * @return array<int, array<string, mixed>>
     */
    public function recentFor(?int $userId, int $limit = 10): array
    {
        return $this->db->fetchAll(
            'SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL
             ORDER BY created_at DESC LIMIT ' . (int) $limit,
            [$userId]
        );
    }

    public function unreadCount(?int $userId): int
    {
        return (int) $this->db->scalar(
            'SELECT COUNT(*) FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0',
            [$userId]
        );
    }

    public function markRead(int $id): void
    {
        $this->db->execute('UPDATE notifications SET is_read = 1 WHERE id = ?', [$id]);
    }

    public function markAllRead(?int $userId): void
    {
        $this->db->execute(
            'UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id IS NULL',
            [$userId]
        );
    }

    public function push(string $title, string $message, string $type = 'info', ?int $userId = null, ?string $link = null): int
    {
        return $this->create([
            'user_id' => $userId,
            'type'    => $type,
            'title'   => $title,
            'message' => $message,
            'link'    => $link,
        ]);
    }
}
