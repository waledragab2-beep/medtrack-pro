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
use App\Models\User;
use App\Services\AuditService;

/**
 * User self-service profile management.
 *
 * @package App\Controllers
 */
final class ProfileController extends Controller
{
    public function __construct(
        View $view,
        Session $session,
        Csrf $csrf,
        Auth $auth,
        private User $users,
        private AuditService $audit
    ) {
        parent::__construct($view, $session, $csrf, $auth);
    }

    public function index(Request $request, Response $response): Response
    {
        return $this->render($response, 'profile/index', [
            'title'   => 'My Profile',
            'profile' => $this->auth->user(),
            'active'  => 'profile',
        ]);
    }

    public function update(Request $request, Response $response): Response
    {
        $id = (int) $this->auth->id();

        $validator = $this->validate($request, [
            'name'  => 'required|maxlen:120',
            'email' => 'required|email|maxlen:160',
        ]);
        if ($validator->fails()) {
            $this->session->flash('error', $validator->first() ?? 'Validation failed.');
            return $this->redirect($response, '/profile');
        }

        if ($this->users->emailExists((string) $request->input('email'), $id)) {
            $this->session->flash('error', 'Email already registered.');
            return $this->redirect($response, '/profile');
        }

        $this->users->update($id, [
            'name'  => (string) $request->input('name'),
            'email' => (string) $request->input('email'),
            'phone' => (string) $request->input('phone', ''),
        ]);

        $this->audit->log('update', 'Updated own profile', 'user', $id);
        $this->session->flash('success', 'Profile updated.');

        return $this->redirect($response, '/profile');
    }

    public function changePassword(Request $request, Response $response): Response
    {
        $id      = (int) $this->auth->id();
        $user    = $this->users->find($id);
        $current = (string) $request->input('current_password', '');

        if ($user === null || !password_verify($current, (string) $user['password_hash'])) {
            $this->session->flash('error', 'Current password is incorrect.');
            return $this->redirect($response, '/profile');
        }

        $validator = $this->validate($request, [
            'password' => 'required|minlen:8|confirmed',
        ]);
        if ($validator->fails()) {
            $this->session->flash('error', $validator->first() ?? 'Validation failed.');
            return $this->redirect($response, '/profile');
        }

        $this->users->updatePassword($id, (string) $request->input('password'));
        $this->audit->log('security', 'Changed own password', 'user', $id);
        $this->session->flash('success', 'Password changed successfully.');

        return $this->redirect($response, '/profile');
    }

    public function preferences(Request $request, Response $response): Response
    {
        $id = (int) $this->auth->id();

        $locale = (string) $request->input('locale', 'en');
        $theme  = (string) $request->input('theme', 'light');

        $this->users->update($id, [
            'locale' => in_array($locale, ['en', 'ar'], true) ? $locale : 'en',
            'theme'  => in_array($theme, ['light', 'dark'], true) ? $theme : 'light',
        ]);

        $this->session->flash('success', 'Preferences saved.');
        return $this->redirect($response, '/profile');
    }
}
