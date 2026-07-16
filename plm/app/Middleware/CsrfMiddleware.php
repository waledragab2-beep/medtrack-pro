<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Csrf;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;

/**
 * Verifies CSRF tokens on state-changing requests.
 *
 * @package App\Middleware
 */
final class CsrfMiddleware implements MiddlewareInterface
{
    public function __construct(private Csrf $csrf, private Session $session)
    {
    }

    public function handle(Request $request, Response $response): ?Response
    {
        if (in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return null;
        }

        $token = $request->input('_csrf_token') ?? $request->header('X-CSRF-Token');
        if ($this->csrf->validate(is_string($token) ? $token : null)) {
            return null;
        }

        if ($request->wantsJson()) {
            return $response->json(['error' => 'CSRF token mismatch.'], 419);
        }

        $this->session->flash('error', 'Security token expired. Please retry.');
        return $response->redirect($request->header('Referer') ?? url('dashboard'));
    }
}
