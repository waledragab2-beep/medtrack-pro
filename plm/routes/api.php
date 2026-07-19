<?php

declare(strict_types=1);

use App\Core\Router;
use App\Controllers\Api\LicenseApiController;
use App\Controllers\Api\AuthApiController;
use App\Middleware\ApiKeyMiddleware;

/**
 * REST API route registration (prefix: /api/v1).
 *
 * @return callable(Router):void
 */
return static function (Router $router): void {
    $apiAuth = [ApiKeyMiddleware::class];

    // Public token issuance (API key + secret exchanged for JWT).
    $router->post('/api/v1/auth/token', [AuthApiController::class, 'token']);

    // License operations (protected by API key or JWT).
    $router->post('/api/v1/licenses/activate', [LicenseApiController::class, 'activate'], $apiAuth);
    $router->post('/api/v1/licenses/verify', [LicenseApiController::class, 'verify'], $apiAuth);
    $router->post('/api/v1/licenses/deactivate', [LicenseApiController::class, 'deactivate'], $apiAuth);
    $router->get('/api/v1/licenses/{key}', [LicenseApiController::class, 'show'], $apiAuth);

    // Public license check for browser / client-side apps (no API key; safe —
    // returns only validity, never secrets). Rate-limited per IP internally.
    $router->post('/api/v1/licenses/check', [LicenseApiController::class, 'publicCheck']);
    $router->get('/api/v1/licenses/{key}/check', [LicenseApiController::class, 'publicCheck']);

    // Public key distribution for offline SDK verification.
    $router->get('/api/v1/public-key', [LicenseApiController::class, 'publicKey']);

    // Health check.
    $router->get('/api/v1/health', [LicenseApiController::class, 'health']);
};
