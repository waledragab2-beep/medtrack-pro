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
use App\Models\Module;
use App\Models\Product;
use App\Models\SoftwareVersion;
use App\Services\AuditService;

/**
 * Product CRUD management.
 *
 * @package App\Controllers
 */
final class ProductController extends Controller
{
    public function __construct(
        View $view,
        Session $session,
        Csrf $csrf,
        Auth $auth,
        private Product $products,
        private SoftwareVersion $versions,
        private Module $modules,
        private AuditService $audit
    ) {
        parent::__construct($view, $session, $csrf, $auth);
    }

    public function index(Request $request, Response $response): Response
    {
        $term    = (string) $request->query('q', '');
        $page    = (int) $request->query('page', 1);
        $perPage = (int) config('general.items_per_page', 20);

        $where  = '1';
        $params = [];
        if ($term !== '') {
            $where   = '(name LIKE ? OR code LIKE ? OR category LIKE ?)';
            $like    = '%' . $term . '%';
            $params  = [$like, $like, $like];
        }

        $result = $this->products->paginate($page, $perPage, $where, $params, 'created_at DESC');

        return $this->render($response, 'products/index', [
            'title'  => 'Products',
            'result' => $result,
            'term'   => $term,
            'active' => 'products',
        ]);
    }

    public function create(Request $request, Response $response): Response
    {
        return $this->render($response, 'products/form', [
            'title'   => 'New Product',
            'product' => null,
            'active'  => 'products',
        ]);
    }

    public function store(Request $request, Response $response): Response
    {
        $validator = $this->validate($request, [
            'name' => 'required|maxlen:160',
            'code' => 'required|alphanum|maxlen:60',
            'status' => 'required|in:active,inactive',
        ]);
        if ($validator->fails()) {
            $this->session->flash('error', $validator->first() ?? 'Validation failed.');
            return $this->back($response, $request);
        }

        $code = (string) $request->input('code');
        if ($this->products->codeExists($code)) {
            $this->session->flash('error', 'Product code already exists.');
            return $this->back($response, $request);
        }

        $data = $this->collect($request);
        $id   = $this->products->create($data);
        $this->audit->log('create', 'Created product: ' . $data['name'], 'product', $id, null, $data);
        $this->session->flash('success', 'Product created successfully.');

        return $this->redirect($response, '/products/' . $id);
    }

    public function show(Request $request, Response $response): Response
    {
        $id      = (int) $request->route('id');
        $product = $this->products->find($id);
        if ($product === null) {
            return $this->notFound($response);
        }

        return $this->render($response, 'products/show', [
            'title'    => $product['name'],
            'product'  => $product,
            'versions' => $this->versions->forProduct($id),
            'modules'  => $this->modules->forProduct($id),
            'active'   => 'products',
        ]);
    }

    public function edit(Request $request, Response $response): Response
    {
        $id      = (int) $request->route('id');
        $product = $this->products->find($id);
        if ($product === null) {
            return $this->notFound($response);
        }

        return $this->render($response, 'products/form', [
            'title'   => 'Edit Product',
            'product' => $product,
            'active'  => 'products',
        ]);
    }

    public function update(Request $request, Response $response): Response
    {
        $id      = (int) $request->route('id');
        $product = $this->products->find($id);
        if ($product === null) {
            return $this->notFound($response);
        }

        $validator = $this->validate($request, [
            'name' => 'required|maxlen:160',
            'code' => 'required|alphanum|maxlen:60',
            'status' => 'required|in:active,inactive',
        ]);
        if ($validator->fails()) {
            $this->session->flash('error', $validator->first() ?? 'Validation failed.');
            return $this->back($response, $request);
        }

        if ($this->products->codeExists((string) $request->input('code'), $id)) {
            $this->session->flash('error', 'Product code already exists.');
            return $this->back($response, $request);
        }

        $data = $this->collect($request);
        $this->products->update($id, $data);
        $this->audit->log('update', 'Updated product: ' . $data['name'], 'product', $id, $product, $data);
        $this->session->flash('success', 'Product updated successfully.');

        return $this->redirect($response, '/products/' . $id);
    }

    public function destroy(Request $request, Response $response): Response
    {
        $id      = (int) $request->route('id');
        $product = $this->products->find($id);
        if ($product === null) {
            return $this->notFound($response);
        }

        if ($this->products->licenseCount($id) > 0) {
            $this->session->flash('error', 'Cannot delete a product that has licenses.');
            return $this->redirect($response, '/products/' . $id);
        }

        $this->products->delete($id);
        $this->audit->log('delete', 'Deleted product: ' . $product['name'], 'product', $id, $product);
        $this->session->flash('success', 'Product deleted.');

        return $this->redirect($response, '/products');
    }

    /**
     * @return array<string, mixed>
     */
    private function collect(Request $request): array
    {
        return $request->only(['name', 'code', 'description', 'category', 'latest_version', 'status']);
    }

    private function notFound(Response $response): Response
    {
        return $response->status(404)->body(
            $this->view->render('errors/404', $this->viewDefaults(), 'layouts/app')
        );
    }
}
