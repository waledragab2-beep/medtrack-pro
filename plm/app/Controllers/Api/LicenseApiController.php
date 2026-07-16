<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Request;
use App\Core\Response;
use App\Models\License;
use App\Services\EncryptionService;
use App\Services\LicenseService;

/**
 * REST API controller for license activation, verification and status.
 *
 * All responses are JSON. This is the online endpoint used by the License SDK
 * on client devices.
 *
 * @package App\Controllers\Api
 */
final class LicenseApiController
{
    public function __construct(
        private License $licenses,
        private LicenseService $licenseService,
        private EncryptionService $crypto
    ) {
    }

    public function activate(Request $request, Response $response): Response
    {
        $key        = (string) $request->input('license_key', '');
        $components = $this->components($request);

        if ($key === '') {
            return $response->json(['success' => false, 'message' => 'license_key is required.'], 422);
        }

        $result = $this->licenseService->activate($key, $components, $request->ip(), $request->userAgent());
        $ok     = $result['status'] === 'active';

        return $response->json(array_merge(['success' => $ok], $result), $ok ? 200 : 409);
    }

    public function verify(Request $request, Response $response): Response
    {
        $key        = (string) $request->input('license_key', '');
        $components = $this->components($request);

        if ($key === '') {
            return $response->json(['success' => false, 'message' => 'license_key is required.'], 422);
        }

        $result = $this->licenseService->verify($key, $components, $request->ip(), $request->userAgent());
        return $response->json(array_merge(['success' => $result['valid']], $result), $result['valid'] ? 200 : 409);
    }

    public function deactivate(Request $request, Response $response): Response
    {
        $key        = (string) $request->input('license_key', '');
        $components = $this->components($request);

        $result = $this->licenseService->deactivate($key, $components, $request->ip(), $request->userAgent());
        $ok     = $result['status'] === 'deactivated';

        return $response->json(array_merge(['success' => $ok], $result), $ok ? 200 : 409);
    }

    public function show(Request $request, Response $response): Response
    {
        $key     = (string) $request->route('key');
        $license = $this->licenses->findByKey($key);

        if ($license === null) {
            return $response->json(['success' => false, 'message' => 'License not found.'], 404);
        }

        return $response->json([
            'success' => true,
            'license' => [
                'license_number' => $license['license_number'],
                'type'           => $license['type'],
                'status'         => $license['status'],
                'issue_date'     => $license['issue_date'],
                'expire_date'    => $license['expire_date'],
                'days_remaining' => $this->licenseService->daysRemaining($license),
                'users_limit'    => (int) $license['users_limit'],
                'devices_limit'  => (int) $license['devices_limit'],
                'activation_count' => (int) $license['activation_count'],
                'modules'        => json_decode((string) $license['modules'], true) ?? [],
            ],
        ]);
    }

    public function publicKey(Request $request, Response $response): Response
    {
        return $response->json([
            'success'    => true,
            'public_key' => $this->crypto->publicKey(),
            'algorithm'  => 'RSA-4096 / SHA-256',
        ]);
    }

    public function health(Request $request, Response $response): Response
    {
        return $response->json([
            'success' => true,
            'service' => 'Prima License Manager API',
            'version' => config('app.version'),
            'time'    => date('c'),
        ]);
    }

    /**
     * @return array<string, string>
     */
    private function components(Request $request): array
    {
        $components = $request->input('components', []);
        if (!is_array($components)) {
            $components = [];
        }
        // Allow flat fields too.
        foreach (['cpu', 'motherboard', 'disk_serial', 'mac_address', 'bios_uuid', 'machine_guid', 'windows_sid', 'device_name', 'os_info'] as $field) {
            if ($request->has($field)) {
                $components[$field] = (string) $request->input($field);
            }
        }
        return array_map('strval', $components);
    }
}
