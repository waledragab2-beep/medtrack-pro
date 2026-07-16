<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Request;
use App\Core\Response;
use App\Models\AuditLog;
use App\Core\Auth;
use App\Core\Csrf;
use App\Core\Session;
use App\Core\View;

/**
 * Audit log viewer.
 *
 * @package App\Controllers
 */
final class AuditController extends Controller
{
    public function __construct(
        View $view,
        Session $session,
        Csrf $csrf,
        Auth $auth,
        private AuditLog $auditLog
    ) {
        parent::__construct($view, $session, $csrf, $auth);
    }

    public function index(Request $request, Response $response): Response
    {
        $term    = (string) $request->query('q', '');
        $action  = (string) $request->query('action', 'all');
        $page    = (int) $request->query('page', 1);
        $perPage = (int) config('general.items_per_page', 20);

        $result = $this->auditLog->search($term, $action, $page, $perPage);

        return $this->render($response, 'audit/index', [
            'title'   => 'Audit Logs',
            'result'  => $result,
            'term'    => $term,
            'action'  => $action,
            'actions' => $this->auditLog->distinctActions(),
            'active'  => 'audit',
        ]);
    }
}
