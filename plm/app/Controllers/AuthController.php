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
use App\Models\LoginAttempt;
use App\Models\User;
use App\Services\AuditService;

/**
 * Handles authentication: login, logout and lockout enforcement.
 *
 * @package App\Controllers
 */
final class AuthController extends Controller
{
    public function __construct(
        View $view,
        Session $session,
        Csrf $csrf,
        Auth $auth,
        private User $users,
        private LoginAttempt $attempts,
        private AuditService $audit
    ) {
        parent::__construct($view, $session, $csrf, $auth);
    }

    public function root(Request $request, Response $response): Response
    {
        return $this->redirect($response, $this->auth->check() ? '/dashboard' : '/login');
    }

    public function showLogin(Request $request, Response $response): Response
    {
        return $this->render($response, 'auth/login', [
            'title' => 'Sign In',
        ], 'layouts/auth');
    }

    public function login(Request $request, Response $response): Response
    {
        $ip = $request->ip();

        // Rate-limit by IP.
        $maxAttempts   = (int) config('security.max_login_attempts', 5);
        $lockoutWindow = (int) config('security.lockout_time', 900);
        if ($this->attempts->recentFailures($ip, $lockoutWindow) >= $maxAttempts) {
            $this->session->flash('error', 'Too many failed attempts. Please try again later.');
            return $this->back($response, $request);
        }

        $username = (string) $request->input('username', '');
        $password = (string) $request->input('password', '');

        $validator = $this->validate($request, [
            'username' => 'required',
            'password' => 'required',
        ]);
        if ($validator->fails()) {
            $this->session->flash('error', $validator->first() ?? 'Invalid credentials.');
            return $this->back($response, $request);
        }

        $user = $this->auth->attempt($username, $password);

        if ($user === null) {
            $this->attempts->record($username, $ip, false, $request->userAgent());
            $this->session->flash('error', 'Invalid username or password.');
            return $this->back($response, $request);
        }

        $this->attempts->record($username, $ip, true, $request->userAgent());
        $this->attempts->clearFor($ip);
        $this->users->recordLogin((int) $user['id'], $ip);
        $this->auth->login($user);
        $this->audit->log('login', 'User logged in', 'user', (int) $user['id']);

        $intended = $this->session->get('_intended', '/dashboard');
        $this->session->remove('_intended');

        return $this->redirect($response, is_string($intended) ? $intended : '/dashboard');
    }

    public function logout(Request $request, Response $response): Response
    {
        $this->audit->log('logout', 'User logged out', 'user', $this->auth->id());
        $this->auth->logout();
        $this->session->flash('success', 'You have been signed out.');
        return $this->redirect($response, '/login');
    }
}
