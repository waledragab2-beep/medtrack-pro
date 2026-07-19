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
use App\Models\Customer;
use App\Services\AuditService;

/**
 * Customer CRUD management.
 *
 * @package App\Controllers
 */
final class CustomerController extends Controller
{
    public function __construct(
        View $view,
        Session $session,
        Csrf $csrf,
        Auth $auth,
        Translator $translator,
        private Customer $customers,
        private AuditService $audit
    ) {
        parent::__construct($view, $session, $csrf, $auth, $translator);
    }

    public function index(Request $request, Response $response): Response
    {
        $term    = (string) $request->query('q', '');
        $status  = (string) $request->query('status', 'all');
        $page    = (int) $request->query('page', 1);
        $perPage = (int) config('general.items_per_page', 20);

        $result = $this->customers->search($term, $status, $page, $perPage);

        return $this->render($response, 'customers/index', [
            'title'   => 'Customers',
            'result'  => $result,
            'term'    => $term,
            'status'  => $status,
            'active'  => 'customers',
        ]);
    }

    public function create(Request $request, Response $response): Response
    {
        return $this->render($response, 'customers/form', [
            'title'    => 'New Customer',
            'customer' => null,
            'active'   => 'customers',
        ]);
    }

    public function store(Request $request, Response $response): Response
    {
        $validator = $this->validate($request, [
            'company_name' => 'required|maxlen:180',
            'email'        => 'email|maxlen:160',
            'website'      => 'maxlen:180',
            'status'       => 'required|in:active,inactive,suspended',
        ]);

        if ($validator->fails()) {
            $this->session->flash('error', $validator->first() ?? 'Validation failed.');
            return $this->back($response, $request);
        }

        $data               = $this->collect($request);
        $data['created_by'] = $this->auth->id();
        $id                 = $this->customers->create($data);

        $this->audit->log('create', 'Created customer: ' . $data['company_name'], 'customer', $id, null, $data);
        $this->session->flash('success', 'Customer created successfully.');

        return $this->redirect($response, '/customers/' . $id);
    }

    public function show(Request $request, Response $response): Response
    {
        $id       = (int) $request->route('id');
        $customer = $this->customers->find($id);
        if ($customer === null) {
            return $this->notFound($response);
        }

        $licenses = $this->customers->db()->fetchAll(
            'SELECT l.*, p.name AS product_name FROM licenses l JOIN products p ON p.id = l.product_id
             WHERE l.customer_id = ? ORDER BY l.created_at DESC',
            [$id]
        );

        return $this->render($response, 'customers/show', [
            'title'    => $customer['company_name'],
            'customer' => $customer,
            'licenses' => $licenses,
            'active'   => 'customers',
        ]);
    }

    public function edit(Request $request, Response $response): Response
    {
        $id       = (int) $request->route('id');
        $customer = $this->customers->find($id);
        if ($customer === null) {
            return $this->notFound($response);
        }

        return $this->render($response, 'customers/form', [
            'title'    => 'Edit Customer',
            'customer' => $customer,
            'active'   => 'customers',
        ]);
    }

    public function update(Request $request, Response $response): Response
    {
        $id       = (int) $request->route('id');
        $customer = $this->customers->find($id);
        if ($customer === null) {
            return $this->notFound($response);
        }

        $validator = $this->validate($request, [
            'company_name' => 'required|maxlen:180',
            'email'        => 'email|maxlen:160',
            'status'       => 'required|in:active,inactive,suspended',
        ]);
        if ($validator->fails()) {
            $this->session->flash('error', $validator->first() ?? 'Validation failed.');
            return $this->back($response, $request);
        }

        $data = $this->collect($request);
        $this->customers->update($id, $data);
        $this->audit->log('update', 'Updated customer: ' . $data['company_name'], 'customer', $id, $customer, $data);
        $this->session->flash('success', 'Customer updated successfully.');

        return $this->redirect($response, '/customers/' . $id);
    }

    public function destroy(Request $request, Response $response): Response
    {
        $id       = (int) $request->route('id');
        $customer = $this->customers->find($id);
        if ($customer === null) {
            return $this->notFound($response);
        }

        if ($this->customers->licenseCount($id) > 0) {
            $this->session->flash('error', 'Cannot delete a customer that has licenses. Remove its licenses first.');
            return $this->redirect($response, '/customers/' . $id);
        }

        $this->customers->delete($id);
        $this->audit->log('delete', 'Deleted customer: ' . $customer['company_name'], 'customer', $id, $customer);
        $this->session->flash('success', 'Customer deleted.');

        return $this->redirect($response, '/customers');
    }

    /**
     * @return array<string, mixed>
     */
    private function collect(Request $request): array
    {
        return $request->only([
            'company_name', 'contact_person', 'phone', 'mobile', 'email', 'website',
            'country', 'city', 'address', 'vat_number', 'commercial_reg', 'notes', 'status',
        ]);
    }

    private function notFound(Response $response): Response
    {
        return $response->status(404)->body(
            $this->view->render('errors/404', $this->viewDefaults(), 'layouts/app')
        );
    }
}
