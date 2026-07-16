<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Core\View;

/**
 * Authorizes a request against a required permission derived from the route.
 *
 * The permission is inferred from the first URI segment plus the action verb
 * (view/manage). This provides coarse module-level authorization; controllers
 * may still enforce finer-grained checks.
 *
 * @package App\Middleware
 */
final class PermissionMiddleware implements MiddlewareInterface
{
    /** @var array<string, string> Map of URI segment to permission module. */
    private const MODULE_MAP = [
        'customers'     => 'customers',
        'products'      => 'products',
        'versions'      => 'products',
        'licenses'      => 'licenses',
        'devices'       => 'devices',
        'users'         => 'users',
        'roles'         => 'roles',
        'audit'         => 'audit',
        'reports'       => 'reports',
        'settings'      => 'settings',
        'backups'       => 'backups',
        'notifications' => 'notifications',
    ];

    public function __construct(
        private Auth $auth,
        private Session $session,
        private View $view
    ) {
    }

    public function handle(Request $request, Response $response): ?Response
    {
        $segments = array_values(array_filter(explode('/', $request->uri())));
        $module   = $segments[0] ?? '';

        if (!isset(self::MODULE_MAP[$module])) {
            return null; // Not a guarded module.
        }

        $permModule = self::MODULE_MAP[$module];
        $isWrite    = !in_array($request->method(), ['GET', 'HEAD'], true)
            || in_array($segments[1] ?? '', ['create', 'edit', 'delete', 'store', 'update'], true);

        $required = $permModule . '.' . ($isWrite ? 'manage' : 'view');

        if ($this->auth->can($required) || $this->auth->can($permModule . '.manage')) {
            return null;
        }

        if ($request->wantsJson()) {
            return $response->json(['error' => 'Forbidden.', 'required' => $required], 403);
        }

        $this->session->flash('error', 'You do not have permission to access this resource.');
        return $response->status(403)->body(
            $this->view->render('errors/403', ['auth' => $this->auth], 'layouts/app')
        );
    }
}
