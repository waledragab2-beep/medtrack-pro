<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;

/**
 * Ensures the request is authenticated; redirects guests to login.
 *
 * @package App\Middleware
 */
final class AuthMiddleware implements MiddlewareInterface
{
    public function __construct(private Auth $auth, private Session $session)
    {
    }

    public function handle(Request $request, Response $response): ?Response
    {
        if ($this->auth->check()) {
            return null;
        }

        if ($request->wantsJson()) {
            return $response->json(['error' => 'Unauthenticated.'], 401);
        }

        $this->session->set('_intended', $request->uri());
        $base = rtrim((string) config('app.url', ''), '/');
        return $response->redirect($base . '/login');
    }
}
