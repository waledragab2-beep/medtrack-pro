<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Encapsulates the incoming HTTP request.
 *
 * @package App\Core
 */
final class Request
{
    /** @var array<string, mixed> */
    private array $get;

    /** @var array<string, mixed> */
    private array $post;

    /** @var array<string, mixed> */
    private array $server;

    /** @var array<string, mixed> */
    private array $files;

    /** @var array<string, mixed> */
    private array $json;

    /** @var array<string, string> */
    private array $routeParams = [];

    public function __construct()
    {
        $this->get    = $_GET;
        $this->post   = $_POST;
        $this->server = $_SERVER;
        $this->files  = $_FILES;
        $this->json   = $this->parseJsonBody();
    }

    /**
     * @return array<string, mixed>
     */
    private function parseJsonBody(): array
    {
        $contentType = $this->server['CONTENT_TYPE'] ?? '';
        if (!str_contains((string) $contentType, 'application/json')) {
            return [];
        }

        $raw = file_get_contents('php://input') ?: '';
        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : [];
    }

    public function method(): string
    {
        $method = strtoupper($this->server['REQUEST_METHOD'] ?? 'GET');

        if ($method === 'POST' && isset($this->post['_method'])) {
            return strtoupper((string) $this->post['_method']);
        }

        return $method;
    }

    public function uri(): string
    {
        $uri = $this->server['REQUEST_URI'] ?? '/';
        $uri = parse_url((string) $uri, PHP_URL_PATH) ?: '/';
        return '/' . trim($uri, '/');
    }

    public function isPost(): bool
    {
        return $this->method() === 'POST';
    }

    public function isAjax(): bool
    {
        return strtolower($this->server['HTTP_X_REQUESTED_WITH'] ?? '') === 'xmlhttprequest';
    }

    public function wantsJson(): bool
    {
        $accept = $this->server['HTTP_ACCEPT'] ?? '';
        return $this->isAjax()
            || str_contains((string) $accept, 'application/json')
            || str_starts_with($this->uri(), '/api/');
    }

    /**
     * Retrieve an input value (JSON, POST then GET), trimmed if string.
     */
    public function input(string $key, mixed $default = null): mixed
    {
        $value = $this->json[$key] ?? $this->post[$key] ?? $this->get[$key] ?? $default;
        return is_string($value) ? trim($value) : $value;
    }

    /**
     * Retrieve all merged input.
     *
     * @return array<string, mixed>
     */
    public function all(): array
    {
        return array_merge($this->get, $this->post, $this->json);
    }

    /**
     * Retrieve only the given keys.
     *
     * @param string[] $keys
     * @return array<string, mixed>
     */
    public function only(array $keys): array
    {
        $result = [];
        foreach ($keys as $key) {
            $result[$key] = $this->input($key);
        }
        return $result;
    }

    public function query(string $key, mixed $default = null): mixed
    {
        return $this->get[$key] ?? $default;
    }

    public function has(string $key): bool
    {
        return isset($this->json[$key]) || isset($this->post[$key]) || isset($this->get[$key]);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function file(string $key): ?array
    {
        return $this->files[$key] ?? null;
    }

    public function header(string $name): ?string
    {
        $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        $value = $this->server[$key] ?? null;
        return $value !== null ? (string) $value : null;
    }

    public function bearerToken(): ?string
    {
        $header = $this->header('Authorization') ?? '';
        if (preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
            return $m[1];
        }
        return null;
    }

    public function ip(): string
    {
        foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
            if (!empty($this->server[$key])) {
                $ip = explode(',', (string) $this->server[$key])[0];
                return trim($ip);
            }
        }
        return '0.0.0.0';
    }

    public function userAgent(): string
    {
        return (string) ($this->server['HTTP_USER_AGENT'] ?? 'unknown');
    }

    /**
     * @param array<string, string> $params
     */
    public function setRouteParams(array $params): void
    {
        $this->routeParams = $params;
    }

    public function route(string $key, ?string $default = null): ?string
    {
        return $this->routeParams[$key] ?? $default;
    }
}
