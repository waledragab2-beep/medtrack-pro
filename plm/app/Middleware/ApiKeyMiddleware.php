<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Request;
use App\Core\Response;
use App\Models\ApiKey;
use App\Services\JwtService;

/**
 * Authenticates API requests via an API key header or a bearer JWT.
 *
 * Also enforces a simple in-memory per-IP rate limit backed by the filesystem
 * so it works without Redis on shared hosting.
 *
 * @package App\Middleware
 */
final class ApiKeyMiddleware implements MiddlewareInterface
{
    public function __construct(private ApiKey $apiKeys, private JwtService $jwt)
    {
    }

    public function handle(Request $request, Response $response): ?Response
    {
        if (!$this->rateLimit($request)) {
            return $response->json(['error' => 'Rate limit exceeded.'], 429);
        }

        // Bearer JWT.
        $token = $request->bearerToken();
        if ($token !== null && $this->jwt->decode($token) !== null) {
            return null;
        }

        // API key header.
        $apiKey = $request->header('X-API-Key');
        if ($apiKey !== null) {
            $record = $this->apiKeys->findByKey($apiKey);
            if ($record !== null) {
                $this->apiKeys->touch((int) $record['id']);
                return null;
            }
        }

        return $response->json(['error' => 'Unauthorized. Provide a valid X-API-Key or Bearer token.'], 401);
    }

    private function rateLimit(Request $request): bool
    {
        $limit  = (int) config('security.rate_limit', 120);
        $ip     = preg_replace('/[^a-zA-Z0-9]/', '_', $request->ip()) ?? 'unknown';
        $file   = (string) config('paths.temp') . '/rl_' . $ip . '.json';
        $now    = time();
        $window = 60;

        $data = ['count' => 0, 'start' => $now];
        if (is_readable($file)) {
            $decoded = json_decode((string) file_get_contents($file), true);
            if (is_array($decoded) && ($now - (int) $decoded['start']) < $window) {
                $data = $decoded;
            }
        }

        $data['count']++;
        @file_put_contents($file, json_encode($data), LOCK_EX);

        return $data['count'] <= $limit;
    }
}
