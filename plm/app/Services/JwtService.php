<?php

declare(strict_types=1);

namespace App\Services;

use RuntimeException;

/**
 * Minimal JWT (HS256) implementation for API authentication.
 *
 * @package App\Services
 */
final class JwtService
{
    private string $secret;

    public function __construct()
    {
        $keyDir     = (string) config('paths.keys');
        $secretFile = $keyDir . '/app.secret';
        if (!is_readable($secretFile)) {
            throw new RuntimeException('Application secret missing.');
        }
        $this->secret = (string) file_get_contents($secretFile);
    }

    /**
     * Encode a payload into a signed JWT.
     *
     * @param array<string, mixed> $claims
     */
    public function encode(array $claims, int $ttl = 3600): string
    {
        $header  = ['alg' => 'HS256', 'typ' => 'JWT'];
        $now     = time();
        $payload = array_merge($claims, ['iat' => $now, 'exp' => $now + $ttl]);

        $segments   = [];
        $segments[] = $this->base64UrlEncode((string) json_encode($header));
        $segments[] = $this->base64UrlEncode((string) json_encode($payload));

        $signingInput = implode('.', $segments);
        $signature    = hash_hmac('sha256', $signingInput, $this->secret, true);
        $segments[]   = $this->base64UrlEncode($signature);

        return implode('.', $segments);
    }

    /**
     * Decode and verify a JWT, returning its claims or null on failure.
     *
     * @return array<string, mixed>|null
     */
    public function decode(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        [$header64, $payload64, $signature64] = $parts;
        $signingInput = $header64 . '.' . $payload64;
        $expected     = hash_hmac('sha256', $signingInput, $this->secret, true);
        $provided     = $this->base64UrlDecode($signature64);

        if (!hash_equals($expected, $provided)) {
            return null;
        }

        $payload = json_decode($this->base64UrlDecode($payload64), true);
        if (!is_array($payload)) {
            return null;
        }

        if (isset($payload['exp']) && time() >= (int) $payload['exp']) {
            return null;
        }

        return $payload;
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function base64UrlDecode(string $data): string
    {
        $padded = str_pad(strtr($data, '-_', '+/'), strlen($data) % 4 === 0 ? strlen($data) : strlen($data) + 4 - strlen($data) % 4, '=');
        return (string) base64_decode($padded);
    }
}
