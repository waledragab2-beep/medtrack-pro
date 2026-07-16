<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Controller;
use App\Core\Csrf;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Core\View;
use App\Models\Device;
use App\Services\AuditService;

/**
 * Device / activation management.
 *
 * @package App\Controllers
 */
final class DeviceController extends Controller
{
    public function __construct(
        View $view,
        Session $session,
        Csrf $csrf,
        Auth $auth,
        private Device $devices,
        private AuditService $audit
    ) {
        parent::__construct($view, $session, $csrf, $auth);
    }

    public function index(Request $request, Response $response): Response
    {
        $page    = (int) $request->query('page', 1);
        $perPage = (int) config('general.items_per_page', 20);

        $devices = $this->devices->allWithLicense($page, $perPage);
        $total   = $this->devices->count();

        return $this->render($response, 'devices/index', [
            'title'   => 'Devices',
            'devices' => $devices,
            'total'   => $total,
            'page'    => $page,
            'perPage' => $perPage,
            'pages'   => (int) ceil($total / $perPage),
            'active'  => 'devices',
        ]);
    }

    public function block(Request $request, Response $response): Response
    {
        $id = (int) $request->route('id');
        $this->devices->update($id, ['status' => 'blocked']);
        $this->audit->log('block', 'Blocked device #' . $id, 'device', $id);
        $this->session->flash('success', 'Device blocked.');
        return $this->back($response, $request);
    }

    public function unblock(Request $request, Response $response): Response
    {
        $id = (int) $request->route('id');
        $this->devices->update($id, ['status' => 'active']);
        $this->audit->log('unblock', 'Unblocked device #' . $id, 'device', $id);
        $this->session->flash('success', 'Device unblocked.');
        return $this->back($response, $request);
    }

    public function destroy(Request $request, Response $response): Response
    {
        $id = (int) $request->route('id');
        $this->devices->delete($id);
        $this->audit->log('delete', 'Removed device #' . $id, 'device', $id);
        $this->session->flash('success', 'Device removed.');
        return $this->back($response, $request);
    }
}
