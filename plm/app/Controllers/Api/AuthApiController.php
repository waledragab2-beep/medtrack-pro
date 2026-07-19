<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Request;
use App\Core\Response;
use App\Models\ApiKey;
use App\Services\JwtService;

/**
 * API authentication: exchanges an API key + secret for a short-lived JWT.
 *
 * @package App\Controllers\Api
 */
final class AuthApiController
{
    public function __construct(private ApiKey $apiKeys, private JwtService $jwt)
    {
    }

    public function token(Request $request, Response $response): Response
    {
        $key    = (string) $request->input('api_key', '');
        $secret = (string) $request->input('api_secret', '');

        $record = $this->apiKeys->findByKey($key);
        if ($record === null || !password_verify($secret, (string) $record['secret_hash'])) {
            return $response->json(['success' => false, 'message' => 'Invalid API credentials.'], 401);
        }

        $ttl   = (int) config('api.token_ttl', 3600);
        $token = $this->jwt->encode([
            'sub'    => (int) $record['id'],
            'name'   => $record['name'],
            'scopes' => json_decode((string) $record['scopes'], true) ?? [],
        ], $ttl);

        $this->apiKeys->touch((int) $record['id']);

        return $response->json([
            'success'      => true,
            'access_token' => $token,
            'token_type'   => 'Bearer',
            'expires_in'   => $ttl,
        ]);
    }
}
