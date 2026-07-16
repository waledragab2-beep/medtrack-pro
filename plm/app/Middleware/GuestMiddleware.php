<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;

/**
 * Redirects authenticated users away from guest-only pages (e.g. login).
 *
 * @package App\Middleware
 */
final class GuestMiddleware implements MiddlewareInterface
{
    public function __construct(private Auth $auth)
    {
    }

    public function handle(Request $request, Response $response): ?Response
    {
        if ($this->auth->check()) {
            $base = rtrim((string) config('app.url', ''), '/');
            return $response->redirect($base . '/dashboard');
        }
        return null;
    }
}
