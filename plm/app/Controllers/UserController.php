<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Translator;
use App\Core\Controller;
use App\Core\Csrf;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Core\View;
use App\Models\Role;
use App\Models\User;
use App\Services\AuditService;

/**
 * System user management.
 *
 * @package App\Controllers
 */
final class UserController extends Controller
{
    public function __construct(
        View $view,
        Session $session,
        Csrf $csrf,
        Auth $auth,
        Translator $translator,
        private User $users,
        private Role $roles,
        private AuditService $audit
    ) {
        parent::__construct($view, $session, $csrf, $auth, $translator);
    }

    public function index(Request $request, Response $response): Response
    {
        return $this->render($response, 'users/index', [
            'title'  => 'Users',
            'users'  => $this->users->allWithRoles(),
            'active' => 'users',
        ]);
    }

    public function create(Request $request, Response $response): Response
    {
        return $this->render($response, 'users/form', [
            'title'  => 'New User',
            'user'   => null,
            'roles'  => $this->roles->all('id ASC'),
            'active' => 'users',
        ]);
    }

    public function store(Request $request, Response $response): Response
    {
        $validator = $this->validate($request, [
            'name'     => 'required|maxlen:120',
            'username' => 'required|alphanum|minlen:3|maxlen:60',
            'email'    => 'required|email|maxlen:160',
            'password' => 'required|minlen:8',
            'role_id'  => 'required|integer',
        ]);
        if ($validator->fails()) {
            $this->session->flash('error', $validator->first() ?? 'Validation failed.');
            return $this->back($response, $request);
        }

        if ($this->users->usernameExists((string) $request->input('username'))) {
            $this->session->flash('error', 'Username already taken.');
            return $this->back($response, $request);
        }
        if ($this->users->emailExists((string) $request->input('email'))) {
            $this->session->flash('error', 'Email already registered.');
            return $this->back($response, $request);
        }

        $data = $this->collect($request);
        $data['password_hash'] = password_hash(
            (string) $request->input('password'),
            config('security.password_algo'),
            config('security.password_options')
        );

        $id = $this->users->create($data);
        $this->audit->log('create', 'Created user ' . $data['username'], 'user', $id);
        $this->session->flash('success', 'User created successfully.');

        return $this->redirect($response, '/users');
    }

    public function edit(Request $request, Response $response): Response
    {
        $id   = (int) $request->route('id');
        $user = $this->users->find($id);
        if ($user === null) {
            return $this->notFound($response);
        }

        return $this->render($response, 'users/form', [
            'title'  => 'Edit User',
            'user'   => $user,
            'roles'  => $this->roles->all('id ASC'),
            'active' => 'users',
        ]);
    }

    public function update(Request $request, Response $response): Response
    {
        $id   = (int) $request->route('id');
        $user = $this->users->find($id);
        if ($user === null) {
            return $this->notFound($response);
        }

        $validator = $this->validate($request, [
            'name'     => 'required|maxlen:120',
            'username' => 'required|alphanum|minlen:3|maxlen:60',
            'email'    => 'required|email|maxlen:160',
            'role_id'  => 'required|integer',
        ]);
        if ($validator->fails()) {
            $this->session->flash('error', $validator->first() ?? 'Validation failed.');
            return $this->back($response, $request);
        }

        if ($this->users->usernameExists((string) $request->input('username'), $id)) {
            $this->session->flash('error', 'Username already taken.');
            return $this->back($response, $request);
        }
        if ($this->users->emailExists((string) $request->input('email'), $id)) {
            $this->session->flash('error', 'Email already registered.');
            return $this->back($response, $request);
        }

        $data = $this->collect($request);

        $password = (string) $request->input('password', '');
        if ($password !== '') {
            $data['password_hash'] = password_hash($password, config('security.password_algo'), config('security.password_options'));
        }

        $this->users->update($id, $data);
        $this->audit->log('update', 'Updated user ' . $data['username'], 'user', $id);
        $this->session->flash('success', 'User updated successfully.');

        return $this->redirect($response, '/users');
    }

    public function destroy(Request $request, Response $response): Response
    {
        $id   = (int) $request->route('id');
        $user = $this->users->find($id);
        if ($user === null) {
            return $this->notFound($response);
        }

        if ($id === $this->auth->id()) {
            $this->session->flash('error', 'You cannot delete your own account.');
            return $this->redirect($response, '/users');
        }

        $this->users->delete($id);
        $this->audit->log('delete', 'Deleted user ' . $user['username'], 'user', $id);
        $this->session->flash('success', 'User deleted.');

        return $this->redirect($response, '/users');
    }

    /**
     * @return array<string, mixed>
     */
    private function collect(Request $request): array
    {
        return [
            'name'      => (string) $request->input('name'),
            'username'  => (string) $request->input('username'),
            'email'     => (string) $request->input('email'),
            'phone'     => (string) $request->input('phone', ''),
            'role_id'   => (int) $request->input('role_id'),
            'is_active' => $request->input('is_active') ? 1 : 0,
        ];
    }

    private function notFound(Response $response): Response
    {
        return $response->status(404)->body(
            $this->view->render('errors/404', $this->viewDefaults(), 'layouts/app')
        );
    }
}
