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

    /**
     * Public license check for browser / client-side apps.
     *
     * Requires no API key (it never returns secrets — only validity and public
     * metadata). Optionally binds a lightweight browser "device" id to enforce
     * the device limit. Rate-limited per IP to deter abuse. CORS-enabled so it
     * can be called from any front-end origin.
     */
    public function publicCheck(Request $request, Response $response): Response
    {
        $response
            ->header('Access-Control-Allow-Origin', '*')
            ->header('Access-Control-Allow-Headers', 'Content-Type')
            ->header('Cache-Control', 'no-store');

        if (!$this->rateLimit($request)) {
            return $response->json(['valid' => false, 'status' => 'rate_limited', 'message' => 'Too many requests.'], 429);
        }

        $key    = (string) ($request->route('key') ?? $request->input('key', ''));
        $device = (string) $request->input('device', '');

        if ($key === '') {
            return $response->json(['valid' => false, 'status' => 'invalid', 'message' => 'License key is required.'], 422);
        }

        $license = $this->licenses->findByKey($key);
        if ($license === null) {
            return $response->json(['valid' => false, 'status' => 'invalid', 'message' => 'License key not found.'], 404);
        }

        // Auto-expire if overdue.
        if ($this->licenseService->isExpired($license) && $license['status'] === 'active') {
            $this->licenses->update((int) $license['id'], ['status' => 'expired']);
            $license['status'] = 'expired';
        }

        if ($license['status'] !== 'active') {
            return $response->json([
                'valid'   => false,
                'status'  => $license['status'],
                'message' => 'License is ' . $license['status'] . '.',
            ], 409);
        }

        // Optional lightweight device binding (enforces the device limit for
        // browser installs identified by a random client id).
        $deviceState = 'ok';
        if ($device !== '') {
            $deviceState = $this->licenseService->activate(
                $key,
                ['machine_guid' => $device, 'device_name' => 'Browser', 'os_info' => $request->userAgent()],
                $request->ip(),
                $request->userAgent()
            )['status'];
            if ($deviceState === 'limit') {
                return $response->json([
                    'valid'   => false,
                    'status'  => 'device_limit',
                    'message' => 'Device activation limit reached.',
                ], 409);
            }
        }

        return $response->json([
            'valid'          => true,
            'status'         => 'active',
            'license_number' => $license['license_number'],
            'type'           => $license['type'],
            'expire_date'    => $license['expire_date'],
            'days_remaining' => $this->licenseService->daysRemaining($license),
            'modules'        => json_decode((string) $license['modules'], true) ?? [],
            'device'         => $deviceState,
        ]);
    }

    /**
     * Simple filesystem-backed per-IP rate limit (no Redis needed).
     */
    private function rateLimit(Request $request): bool
    {
        $limit  = 60; // requests per minute
        $ip     = preg_replace('/[^a-zA-Z0-9]/', '_', $request->ip()) ?? 'unknown';
        $file   = (string) config('paths.temp') . '/pchk_' . $ip . '.json';
        $now    = time();

        $data = ['count' => 0, 'start' => $now];
        if (is_readable($file)) {
            $decoded = json_decode((string) file_get_contents($file), true);
            if (is_array($decoded) && ($now - (int) ($decoded['start'] ?? 0)) < 60) {
                $data = $decoded;
            }
        }
        $data['count'] = (int) $data['count'] + 1;
        @file_put_contents($file, json_encode($data), LOCK_EX);

        return $data['count'] <= $limit;
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
