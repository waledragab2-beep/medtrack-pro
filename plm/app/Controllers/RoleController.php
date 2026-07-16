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
use App\Models\Permission;
use App\Models\Role;
use App\Services\AuditService;

/**
 * Role and permission management.
 *
 * @package App\Controllers
 */
final class RoleController extends Controller
{
    public function __construct(
        View $view,
        Session $session,
        Csrf $csrf,
        Auth $auth,
        private Role $roles,
        private Permission $permissions,
        private AuditService $audit
    ) {
        parent::__construct($view, $session, $csrf, $auth);
    }

    public function index(Request $request, Response $response): Response
    {
        return $this->render($response, 'roles/index', [
            'title'  => 'Roles & Permissions',
            'roles'  => $this->roles->allWithCounts(),
            'active' => 'roles',
        ]);
    }

    public function create(Request $request, Response $response): Response
    {
        return $this->render($response, 'roles/form', [
            'title'        => 'New Role',
            'role'         => null,
            'permissions'  => $this->permissions->grouped(),
            'assigned'     => [],
            'active'       => 'roles',
        ]);
    }

    public function store(Request $request, Response $response): Response
    {
        $validator = $this->validate($request, [
            'name' => 'required|maxlen:80',
        ]);
        if ($validator->fails()) {
            $this->session->flash('error', $validator->first() ?? 'Validation failed.');
            return $this->back($response, $request);
        }

        $name = (string) $request->input('name');
        $id   = $this->roles->create([
            'name'        => $name,
            'slug'        => slugify($name),
            'description' => (string) $request->input('description', ''),
            'is_system'   => 0,
        ]);

        $perms = $request->input('permissions', []);
        $this->roles->syncPermissions($id, is_array($perms) ? array_map('intval', $perms) : []);

        $this->audit->log('create', 'Created role ' . $name, 'role', $id);
        $this->session->flash('success', 'Role created successfully.');

        return $this->redirect($response, '/roles');
    }

    public function edit(Request $request, Response $response): Response
    {
        $id   = (int) $request->route('id');
        $role = $this->roles->find($id);
        if ($role === null) {
            return $this->notFound($response);
        }

        return $this->render($response, 'roles/form', [
            'title'       => 'Edit Role',
            'role'        => $role,
            'permissions' => $this->permissions->grouped(),
            'assigned'    => $this->roles->permissionIds($id),
            'active'      => 'roles',
        ]);
    }

    public function update(Request $request, Response $response): Response
    {
        $id   = (int) $request->route('id');
        $role = $this->roles->find($id);
        if ($role === null) {
            return $this->notFound($response);
        }

        $validator = $this->validate($request, ['name' => 'required|maxlen:80']);
        if ($validator->fails()) {
            $this->session->flash('error', $validator->first() ?? 'Validation failed.');
            return $this->back($response, $request);
        }

        $this->roles->update($id, [
            'name'        => (string) $request->input('name'),
            'description' => (string) $request->input('description', ''),
        ]);

        // Protect super-admin from losing permissions.
        if ($role['slug'] !== 'super-admin') {
            $perms = $request->input('permissions', []);
            $this->roles->syncPermissions($id, is_array($perms) ? array_map('intval', $perms) : []);
        }

        $this->audit->log('update', 'Updated role ' . $role['name'], 'role', $id);
        $this->session->flash('success', 'Role updated successfully.');

        return $this->redirect($response, '/roles');
    }

    public function destroy(Request $request, Response $response): Response
    {
        $id   = (int) $request->route('id');
        $role = $this->roles->find($id);
        if ($role === null) {
            return $this->notFound($response);
        }

        if ((int) $role['is_system'] === 1) {
            $this->session->flash('error', 'System roles cannot be deleted.');
            return $this->redirect($response, '/roles');
        }

        $userCount = (int) $this->roles->db()->scalar('SELECT COUNT(*) FROM users WHERE role_id = ?', [$id]);
        if ($userCount > 0) {
            $this->session->flash('error', 'Cannot delete a role assigned to users.');
            return $this->redirect($response, '/roles');
        }

        $this->roles->delete($id);
        $this->audit->log('delete', 'Deleted role ' . $role['name'], 'role', $id);
        $this->session->flash('success', 'Role deleted.');

        return $this->redirect($response, '/roles');
    }

    private function notFound(Response $response): Response
    {
        return $response->status(404)->body(
            $this->view->render('errors/404', $this->viewDefaults(), 'layouts/app')
        );
    }
}
