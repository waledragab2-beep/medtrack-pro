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
use App\Libraries\QrCode;
use App\Models\Customer;
use App\Models\Device;
use App\Models\License;
use App\Models\Module;
use App\Models\Product;
use App\Models\SoftwareVersion;
use App\Services\AuditService;
use App\Services\LicenseService;

/**
 * License management: generation, signing, activation status, export and
 * lifecycle operations (revoke / renew).
 *
 * @package App\Controllers
 */
final class LicenseController extends Controller
{
    public function __construct(
        View $view,
        Session $session,
        Csrf $csrf,
        Auth $auth,
        Translator $translator,
        private License $licenses,
        private Customer $customers,
        private Product $products,
        private SoftwareVersion $versions,
        private Module $modules,
        private Device $devices,
        private LicenseService $licenseService,
        private AuditService $audit
    ) {
        parent::__construct($view, $session, $csrf, $auth, $translator);
    }

    public function index(Request $request, Response $response): Response
    {
        $filters = [
            'term'        => (string) $request->query('q', ''),
            'status'      => (string) $request->query('status', 'all'),
            'type'        => (string) $request->query('type', 'all'),
            'customer_id' => (string) $request->query('customer_id', ''),
            'product_id'  => (string) $request->query('product_id', ''),
        ];
        $page    = (int) $request->query('page', 1);
        $perPage = (int) config('general.items_per_page', 20);

        $result = $this->licenses->searchDetailed($filters, $page, $perPage);

        return $this->render($response, 'licenses/index', [
            'title'     => 'Licenses',
            'result'    => $result,
            'filters'   => $filters,
            'customers' => $this->customers->all('company_name ASC'),
            'products'  => $this->products->activeList(),
            'active'    => 'licenses',
        ]);
    }

    public function create(Request $request, Response $response): Response
    {
        return $this->render($response, 'licenses/form', [
            'title'     => 'Generate License',
            'license'   => null,
            'customers' => $this->customers->all('company_name ASC'),
            'products'  => $this->products->activeList(),
            'versions'  => $this->versions->allWithProduct(),
            'modules'   => $this->modules->allList(),
            'types'     => LicenseService::typeDurations(),
            'active'    => 'licenses',
        ]);
    }

    public function store(Request $request, Response $response): Response
    {
        $validator = $this->validate($request, [
            'customer_id'   => 'required|integer',
            'product_id'    => 'required|integer',
            'type'          => 'required|in:trial,monthly,quarterly,semi_annual,yearly,lifetime,developer,enterprise',
            'issue_date'    => 'required|date',
            'users_limit'   => 'required|integer|min:1',
            'devices_limit' => 'required|integer|min:1',
            'branches_limit' => 'required|integer|min:1',
            'price'         => 'numeric|min:0',
        ]);
        if ($validator->fails()) {
            $this->session->flash('error', $validator->first() ?? 'Validation failed.');
            return $this->back($response, $request);
        }

        $data = $this->buildLicenseData($request);

        // Sign the descriptor.
        $signed = $this->licenseService->signDescriptor($this->licenseService->descriptor($data));
        $data['signature'] = $signed['signature'];
        $data['checksum']  = $signed['checksum'];
        $data['created_by'] = $this->auth->id();

        $id = $this->licenses->create($data);
        $this->audit->log('create', 'Generated license ' . $data['license_number'], 'license', $id, null, [
            'license_number' => $data['license_number'],
            'customer_id'    => $data['customer_id'],
            'type'           => $data['type'],
        ]);
        $this->session->flash('success', 'License generated successfully.');

        return $this->redirect($response, '/licenses/' . $id);
    }

    public function show(Request $request, Response $response): Response
    {
        $id      = (int) $request->route('id');
        $license = $this->licenses->detail($id);
        if ($license === null) {
            return $this->notFound($response);
        }

        $verifyUrl = url('api/v1/licenses/' . $license['license_key']);
        $qr        = QrCode::dataUri($license['license_key'], 5, 3);

        return $this->render($response, 'licenses/show', [
            'title'     => 'License ' . $license['license_number'],
            'license'   => $license,
            'devices'   => $this->devices->forLicense($id),
            'qr'        => $qr,
            'verifyUrl' => $verifyUrl,
            'daysLeft'  => $this->licenseService->daysRemaining($license),
            'active'    => 'licenses',
        ]);
    }

    public function edit(Request $request, Response $response): Response
    {
        $id      = (int) $request->route('id');
        $license = $this->licenses->find($id);
        if ($license === null) {
            return $this->notFound($response);
        }

        return $this->render($response, 'licenses/form', [
            'title'     => 'Edit License',
            'license'   => $license,
            'customers' => $this->customers->all('company_name ASC'),
            'products'  => $this->products->activeList(),
            'versions'  => $this->versions->allWithProduct(),
            'modules'   => $this->modules->allList(),
            'types'     => LicenseService::typeDurations(),
            'active'    => 'licenses',
        ]);
    }

    public function update(Request $request, Response $response): Response
    {
        $id      = (int) $request->route('id');
        $license = $this->licenses->find($id);
        if ($license === null) {
            return $this->notFound($response);
        }

        $validator = $this->validate($request, [
            'customer_id'   => 'required|integer',
            'product_id'    => 'required|integer',
            'type'          => 'required',
            'issue_date'    => 'required|date',
            'users_limit'   => 'required|integer|min:1',
            'devices_limit' => 'required|integer|min:1',
            'status'        => 'required|in:active,expired,suspended,revoked,pending',
        ]);
        if ($validator->fails()) {
            $this->session->flash('error', $validator->first() ?? 'Validation failed.');
            return $this->back($response, $request);
        }

        // Preserve immutable identifiers.
        $data                   = $this->buildLicenseData($request, $license);
        $data['license_number'] = $license['license_number'];
        $data['license_key']    = $license['license_key'];
        $data['status']         = (string) $request->input('status');

        // Re-sign after edits.
        $signed = $this->licenseService->signDescriptor($this->licenseService->descriptor($data));
        $data['signature'] = $signed['signature'];
        $data['checksum']  = $signed['checksum'];

        $this->licenses->update($id, $data);
        $this->audit->log('update', 'Updated license ' . $license['license_number'], 'license', $id, $license, $data);
        $this->session->flash('success', 'License updated successfully.');

        return $this->redirect($response, '/licenses/' . $id);
    }

    public function destroy(Request $request, Response $response): Response
    {
        $id      = (int) $request->route('id');
        $license = $this->licenses->find($id);
        if ($license === null) {
            return $this->notFound($response);
        }

        $this->licenses->delete($id);
        $this->audit->log('delete', 'Deleted license ' . $license['license_number'], 'license', $id, $license);
        $this->session->flash('success', 'License deleted.');

        return $this->redirect($response, '/licenses');
    }

    public function revoke(Request $request, Response $response): Response
    {
        $id      = (int) $request->route('id');
        $license = $this->licenses->find($id);
        if ($license === null) {
            return $this->notFound($response);
        }

        $this->licenses->update($id, ['status' => 'revoked']);
        $this->audit->log('revoke', 'Revoked license ' . $license['license_number'], 'license', $id);
        $this->session->flash('success', 'License revoked.');

        return $this->redirect($response, '/licenses/' . $id);
    }

    public function renew(Request $request, Response $response): Response
    {
        $id      = (int) $request->route('id');
        $license = $this->licenses->find($id);
        if ($license === null) {
            return $this->notFound($response);
        }

        $issue  = date('Y-m-d');
        $expire = $this->licenseService->computeExpiry($issue, (string) $license['type']);

        $data = [
            'issue_date'  => $issue,
            'expire_date' => $expire,
            'status'      => 'active',
        ];

        // Re-sign with new dates.
        $descriptor = $this->licenseService->descriptor(array_merge($license, $data));
        $signed     = $this->licenseService->signDescriptor($descriptor);
        $data['signature'] = $signed['signature'];
        $data['checksum']  = $signed['checksum'];

        $this->licenses->update($id, $data);
        $this->audit->log('renew', 'Renewed license ' . $license['license_number'], 'license', $id);
        $this->session->flash('success', 'License renewed until ' . ($expire ?? 'lifetime') . '.');

        return $this->redirect($response, '/licenses/' . $id);
    }

    public function download(Request $request, Response $response): Response
    {
        $id      = (int) $request->route('id');
        $format  = (string) $request->route('format', 'lic');
        $license = $this->licenses->detail($id);
        if ($license === null) {
            return $this->notFound($response);
        }

        $payload  = $this->licenseService->buildLicenseFile($license);
        $ext      = in_array($format, ['lic', 'key', 'dat'], true) ? $format : 'lic';
        $filename = $license['license_number'] . '.' . $ext;

        $this->audit->log('export', 'Downloaded license file ' . $filename, 'license', $id);

        return $response->attachment($payload, $filename, 'application/octet-stream');
    }

    public function qr(Request $request, Response $response): Response
    {
        $id      = (int) $request->route('id');
        $license = $this->licenses->find($id);
        if ($license === null) {
            return $this->notFound($response);
        }

        $svg = QrCode::svg((string) $license['license_key'], 8, 4);
        return $response
            ->header('Content-Type', 'image/svg+xml')
            ->header('Content-Disposition', 'inline; filename="' . $license['license_number'] . '.svg"')
            ->body($svg);
    }

    public function printCertificate(Request $request, Response $response): Response
    {
        $id      = (int) $request->route('id');
        $license = $this->licenses->detail($id);
        if ($license === null) {
            return $this->notFound($response);
        }

        $qr = QrCode::dataUri((string) $license['license_key'], 5, 3);

        return $response->body($this->view->render('licenses/certificate', [
            'license' => $license,
            'qr'      => $qr,
            'company' => config('app.name'),
        ], 'layouts/blank'));
    }

    /**
     * Build a license data array from request input.
     *
     * @param array<string, mixed>|null $existing
     * @return array<string, mixed>
     */
    private function buildLicenseData(Request $request, ?array $existing = null): array
    {
        $type       = (string) $request->input('type');
        $issueDate  = (string) $request->input('issue_date', date('Y-m-d'));
        $expireDate = $request->input('expire_date');

        if (empty($expireDate)) {
            $expireDate = $this->licenseService->computeExpiry($issueDate, $type);
        }

        $selectedModules = $request->input('modules', []);
        if (!is_array($selectedModules)) {
            $selectedModules = [];
        }

        $prefix = (string) config('license.license_prefix', 'PLM');

        return [
            'license_number' => $existing['license_number'] ?? $this->licenseService->generateLicenseNumber($prefix),
            'license_key'    => $existing['license_key'] ?? $this->licenseService->generateLicenseKey(),
            'customer_id'    => (int) $request->input('customer_id'),
            'product_id'     => (int) $request->input('product_id'),
            'version_id'     => $request->input('version_id') ? (int) $request->input('version_id') : null,
            'type'           => $type,
            'issue_date'     => $issueDate,
            'expire_date'    => $expireDate,
            'users_limit'    => (int) $request->input('users_limit', 1),
            'devices_limit'  => (int) $request->input('devices_limit', 1),
            'branches_limit' => (int) $request->input('branches_limit', 1),
            'modules'        => json_encode(array_values($selectedModules)),
            'price'          => (float) $request->input('price', 0),
            'currency'       => (string) $request->input('currency', config('general.currency', 'USD')),
            'status'         => $existing['status'] ?? 'active',
            'notes'          => (string) $request->input('notes', ''),
        ];
    }

    private function notFound(Response $response): Response
    {
        return $response->status(404)->body(
            $this->view->render('errors/404', $this->viewDefaults(), 'layouts/app')
        );
    }
}
