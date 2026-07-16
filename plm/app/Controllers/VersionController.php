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
use App\Models\Product;
use App\Models\SoftwareVersion;
use App\Services\AuditService;

/**
 * Software version CRUD management.
 *
 * @package App\Controllers
 */
final class VersionController extends Controller
{
    public function __construct(
        View $view,
        Session $session,
        Csrf $csrf,
        Auth $auth,
        private SoftwareVersion $versions,
        private Product $products,
        private AuditService $audit
    ) {
        parent::__construct($view, $session, $csrf, $auth);
    }

    public function index(Request $request, Response $response): Response
    {
        return $this->render($response, 'versions/index', [
            'title'    => 'Software Versions',
            'versions' => $this->versions->allWithProduct(),
            'active'   => 'versions',
        ]);
    }

    public function create(Request $request, Response $response): Response
    {
        return $this->render($response, 'versions/form', [
            'title'    => 'New Version',
            'version'  => null,
            'products' => $this->products->activeList(),
            'active'   => 'versions',
        ]);
    }

    public function store(Request $request, Response $response): Response
    {
        $validator = $this->validate($request, [
            'product_id'     => 'required|integer',
            'version_number' => 'required|maxlen:40',
            'release_date'   => 'date',
            'status'         => 'required|in:active,deprecated,beta',
        ]);
        if ($validator->fails()) {
            $this->session->flash('error', $validator->first() ?? 'Validation failed.');
            return $this->back($response, $request);
        }

        $data = $this->collect($request);
        $id   = $this->versions->create($data);

        // Keep product's latest_version in sync when marked active.
        if ($data['status'] === 'active') {
            $this->products->update((int) $data['product_id'], ['latest_version' => $data['version_number']]);
        }

        $this->audit->log('create', 'Created version ' . $data['version_number'], 'version', $id, null, $data);
        $this->session->flash('success', 'Version created successfully.');

        return $this->redirect($response, '/versions');
    }

    public function edit(Request $request, Response $response): Response
    {
        $id      = (int) $request->route('id');
        $version = $this->versions->find($id);
        if ($version === null) {
            return $this->notFound($response);
        }

        return $this->render($response, 'versions/form', [
            'title'    => 'Edit Version',
            'version'  => $version,
            'products' => $this->products->activeList(),
            'active'   => 'versions',
        ]);
    }

    public function update(Request $request, Response $response): Response
    {
        $id      = (int) $request->route('id');
        $version = $this->versions->find($id);
        if ($version === null) {
            return $this->notFound($response);
        }

        $validator = $this->validate($request, [
            'product_id'     => 'required|integer',
            'version_number' => 'required|maxlen:40',
            'status'         => 'required|in:active,deprecated,beta',
        ]);
        if ($validator->fails()) {
            $this->session->flash('error', $validator->first() ?? 'Validation failed.');
            return $this->back($response, $request);
        }

        $data = $this->collect($request);
        $this->versions->update($id, $data);
        $this->audit->log('update', 'Updated version ' . $data['version_number'], 'version', $id, $version, $data);
        $this->session->flash('success', 'Version updated successfully.');

        return $this->redirect($response, '/versions');
    }

    public function destroy(Request $request, Response $response): Response
    {
        $id      = (int) $request->route('id');
        $version = $this->versions->find($id);
        if ($version === null) {
            return $this->notFound($response);
        }

        $this->versions->delete($id);
        $this->audit->log('delete', 'Deleted version ' . $version['version_number'], 'version', $id, $version);
        $this->session->flash('success', 'Version deleted.');

        return $this->redirect($response, '/versions');
    }

    /**
     * @return array<string, mixed>
     */
    private function collect(Request $request): array
    {
        $data = $request->only([
            'product_id', 'version_number', 'build_number', 'release_date',
            'release_notes', 'min_supported_license', 'compatibility', 'download_url', 'status',
        ]);
        $data['release_date'] = $data['release_date'] !== '' ? $data['release_date'] : null;
        return $data;
    }

    private function notFound(Response $response): Response
    {
        return $response->status(404)->body(
            $this->view->render('errors/404', $this->viewDefaults(), 'layouts/app')
        );
    }
}
