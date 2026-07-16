<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Secure session manager with flash-message support.
 *
 * @package App\Core
 */
final class Session
{
    private bool $started = false;

    /**
     * @param array<string, mixed> $config
     */
    public function __construct(private array $config)
    {
    }

    public function start(): void
    {
        if ($this->started || session_status() === PHP_SESSION_ACTIVE) {
            $this->started = true;
            return;
        }

        $secure = ($this->config['cookie_secure'] ?? true)
            && (($_SERVER['HTTPS'] ?? '') !== '' || ($_SERVER['SERVER_PORT'] ?? '') === '443');

        session_name($this->config['session_name'] ?? 'PLM_SESSION');
        session_set_cookie_params([
            'lifetime' => $this->config['session_lifetime'] ?? 7200,
            'path'     => '/',
            'domain'   => '',
            'secure'   => $secure,
            'httponly' => $this->config['cookie_httponly'] ?? true,
            'samesite' => $this->config['cookie_samesite'] ?? 'Strict',
        ]);

        session_start();
        $this->started = true;

        // Regenerate periodically to mitigate fixation.
        if (!isset($_SESSION['_created'])) {
            $_SESSION['_created'] = time();
        } elseif (time() - (int) $_SESSION['_created'] > 1800) {
            session_regenerate_id(true);
            $_SESSION['_created'] = time();
        }
    }

    public function get(string $key, mixed $default = null): mixed
    {
        return $_SESSION[$key] ?? $default;
    }

    public function set(string $key, mixed $value): void
    {
        $_SESSION[$key] = $value;
    }

    public function has(string $key): bool
    {
        return isset($_SESSION[$key]);
    }

    public function remove(string $key): void
    {
        unset($_SESSION[$key]);
    }

    public function regenerate(): void
    {
        session_regenerate_id(true);
    }

    public function destroy(): void
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name() ?: 'PLM_SESSION', '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
    }

    /**
     * Set a flash message available on the next request only.
     */
    public function flash(string $type, string $message): void
    {
        $_SESSION['_flash'][$type][] = $message;
    }

    /**
     * @return array<string, string[]>
     */
    public function getFlashes(): array
    {
        $flashes = $_SESSION['_flash'] ?? [];
        unset($_SESSION['_flash']);
        return $flashes;
    }
}
