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
use App\Models\Notification;

/**
 * Notification centre.
 *
 * @package App\Controllers
 */
final class NotificationController extends Controller
{
    public function __construct(
        View $view,
        Session $session,
        Csrf $csrf,
        Auth $auth,
        private Notification $notifications
    ) {
        parent::__construct($view, $session, $csrf, $auth);
    }

    public function index(Request $request, Response $response): Response
    {
        if ($request->wantsJson()) {
            return $this->json($response, [
                'unread' => $this->notifications->unreadCount($this->auth->id()),
                'items'  => $this->notifications->recentFor($this->auth->id(), 10),
            ]);
        }

        return $this->render($response, 'notifications/index', [
            'title'  => 'Notifications',
            'items'  => $this->notifications->recentFor($this->auth->id(), 50),
            'active' => 'notifications',
        ]);
    }

    public function markRead(Request $request, Response $response): Response
    {
        $this->notifications->markRead((int) $request->route('id'));
        if ($request->wantsJson()) {
            return $this->json($response, ['success' => true]);
        }
        return $this->redirect($response, '/notifications');
    }

    public function markAllRead(Request $request, Response $response): Response
    {
        $this->notifications->markAllRead($this->auth->id());
        if ($request->wantsJson()) {
            return $this->json($response, ['success' => true]);
        }
        return $this->redirect($response, '/notifications');
    }
}
