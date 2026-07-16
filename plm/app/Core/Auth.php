<?php

declare(strict_types=1);

namespace App\Core;

use App\Models\User;
use App\Models\Permission;

/**
 * Authentication and authorization gate.
 *
 * Wraps session-based login state and exposes permission checks resolved
 * from the current user's role.
 *
 * @package App\Core
 */
final class Auth
{
    private ?array $cachedUser = null;

    /** @var string[]|null */
    private ?array $cachedPermissions = null;

    public function __construct(
        private Session $session,
        private User $users,
        private Permission $permissions
    ) {
    }

    public function attempt(string $username, string $password): ?array
    {
        $user = $this->users->findByUsernameOrEmail($username);

        if ($user === null || (int) $user['is_active'] !== 1) {
            return null;
        }

        if (!password_verify($password, (string) $user['password_hash'])) {
            return null;
        }

        // Rehash if algorithm parameters changed.
        $config = require dirname(__DIR__, 2) . '/config/config.php';
        if (password_needs_rehash((string) $user['password_hash'], $config['security']['password_algo'], $config['security']['password_options'])) {
            $this->users->updatePassword((int) $user['id'], $password);
        }

        return $user;
    }

    /**
     * @param array<string, mixed> $user
     */
    public function login(array $user): void
    {
        $this->session->regenerate();
        $this->session->set('user_id', (int) $user['id']);
        $this->session->set('user_login_at', time());
        $this->cachedUser = null;
        $this->cachedPermissions = null;
    }

    public function logout(): void
    {
        $this->session->remove('user_id');
        $this->session->remove('user_login_at');
        $this->cachedUser = null;
        $this->cachedPermissions = null;
    }

    public function check(): bool
    {
        return $this->session->has('user_id');
    }

    public function id(): ?int
    {
        $id = $this->session->get('user_id');
        return $id !== null ? (int) $id : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function user(): ?array
    {
        if (!$this->check()) {
            return null;
        }

        if ($this->cachedUser === null) {
            $this->cachedUser = $this->users->findWithRole((int) $this->id());
        }

        return $this->cachedUser;
    }

    /**
     * @return string[]
     */
    public function permissions(): array
    {
        if ($this->cachedPermissions !== null) {
            return $this->cachedPermissions;
        }

        $user = $this->user();
        if ($user === null) {
            return $this->cachedPermissions = [];
        }

        $this->cachedPermissions = $this->permissions->forRole((int) $user['role_id']);
        return $this->cachedPermissions;
    }

    /**
     * Check whether the current user holds a permission.
     */
    public function can(string $permission): bool
    {
        $user = $this->user();
        if ($user === null) {
            return false;
        }

        // Super admin bypass.
        if (($user['role_slug'] ?? '') === 'super-admin') {
            return true;
        }

        return in_array($permission, $this->permissions(), true) || in_array('*', $this->permissions(), true);
    }

    public function isSuperAdmin(): bool
    {
        $user = $this->user();
        return $user !== null && ($user['role_slug'] ?? '') === 'super-admin';
    }
}
