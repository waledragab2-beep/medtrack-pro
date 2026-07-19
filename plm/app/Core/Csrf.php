<?php

declare(strict_types=1);

namespace App\Core;

/**
 * CSRF token generation and validation.
 *
 * @package App\Core
 */
final class Csrf
{
    private const KEY = '_csrf_token';

    public function __construct(private Session $session)
    {
    }

    /**
     * Get the current token, generating one if necessary.
     */
    public function token(): string
    {
        $token = $this->session->get(self::KEY);
        if (!is_string($token) || $token === '') {
            $token = bin2hex(random_bytes(32));
            $this->session->set(self::KEY, $token);
        }
        return $token;
    }

    /**
     * Render a hidden input field carrying the token.
     */
    public function field(): string
    {
        return '<input type="hidden" name="' . self::KEY . '" value="' . $this->token() . '">';
    }

    /**
     * Validate a submitted token in constant time.
     */
    public function validate(?string $token): bool
    {
        $stored = $this->session->get(self::KEY);
        return is_string($stored) && is_string($token) && hash_equals($stored, $token);
    }
}
