<?php

declare(strict_types=1);

/**
 * Global helper functions.
 *
 * These are intentionally small, pure utilities used across views and
 * services. All output helpers escape by default.
 */

if (!function_exists('e')) {
    /**
     * Escape a value for safe HTML output.
     */
    function e(mixed $value): string
    {
        return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}

if (!function_exists('config')) {
    /**
     * Retrieve a configuration value using dot notation.
     */
    function config(string $key, mixed $default = null): mixed
    {
        static $config = null;
        if ($config === null) {
            $config = require dirname(__DIR__, 2) . '/config/config.php';
        }

        $segments = explode('.', $key);
        $value    = $config;
        foreach ($segments as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                return $default;
            }
            $value = $value[$segment];
        }
        return $value;
    }
}

if (!function_exists('asset')) {
    /**
     * Build a URL to a public asset.
     */
    function asset(string $path): string
    {
        $base = rtrim((string) config('app.url', ''), '/');
        return $base . '/assets/' . ltrim($path, '/');
    }
}

if (!function_exists('url')) {
    /**
     * Build an application URL.
     */
    function url(string $path = ''): string
    {
        $base = rtrim((string) config('app.url', ''), '/');
        return $base . '/' . ltrim($path, '/');
    }
}

if (!function_exists('old')) {
    /**
     * Retrieve previously submitted input (from flash).
     *
     * @param array<string, mixed> $data
     */
    function old(string $key, array $data = [], mixed $default = ''): mixed
    {
        return $data[$key] ?? $default;
    }
}

if (!function_exists('str_random')) {
    /**
     * Generate a cryptographically secure random alphanumeric string.
     */
    function str_random(int $length = 32): string
    {
        $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $max   = strlen($chars) - 1;
        $out   = '';
        for ($i = 0; $i < $length; $i++) {
            $out .= $chars[random_int(0, $max)];
        }
        return $out;
    }
}

if (!function_exists('slugify')) {
    /**
     * Convert a string to a URL-friendly slug.
     */
    function slugify(string $text): string
    {
        $text = preg_replace('~[^\pL\d]+~u', '-', $text) ?? '';
        $text = trim($text, '-');
        $text = strtolower($text);
        return preg_replace('~[^-\w]+~', '', $text) ?? '';
    }
}

if (!function_exists('human_date')) {
    /**
     * Format a date for display.
     */
    function human_date(?string $date, string $format = 'Y-m-d'): string
    {
        if ($date === null || $date === '' || $date === '0000-00-00') {
            return '—';
        }
        $ts = strtotime($date);
        return $ts !== false ? date($format, $ts) : '—';
    }
}

if (!function_exists('days_between')) {
    /**
     * Whole days from now until the given date (negative if past).
     */
    function days_between(?string $date): ?int
    {
        if ($date === null || $date === '') {
            return null;
        }
        $ts = strtotime($date);
        if ($ts === false) {
            return null;
        }
        return (int) floor(($ts - time()) / 86400);
    }
}

if (!function_exists('money')) {
    /**
     * Format a monetary amount.
     */
    function money(float|int|string|null $amount, string $currency = ''): string
    {
        return trim($currency . ' ' . number_format((float) $amount, 2));
    }
}

if (!function_exists('array_get')) {
    /**
     * Safe nested array access with dot notation.
     *
     * @param array<string, mixed> $array
     */
    function array_get(array $array, string $key, mixed $default = null): mixed
    {
        foreach (explode('.', $key) as $segment) {
            if (!is_array($array) || !array_key_exists($segment, $array)) {
                return $default;
            }
            $array = $array[$segment];
        }
        return $array;
    }
}

if (!function_exists('status_badge')) {
    /**
     * Map a status string to a Bootstrap badge class.
     */
    function status_badge(string $status): string
    {
        return match (strtolower($status)) {
            'active', 'valid', 'paid', 'completed', 'success' => 'bg-success',
            'expired', 'revoked', 'failed', 'inactive', 'suspended' => 'bg-danger',
            'pending', 'trial', 'expiring' => 'bg-warning text-dark',
            'draft' => 'bg-secondary',
            default => 'bg-info',
        };
    }
}
