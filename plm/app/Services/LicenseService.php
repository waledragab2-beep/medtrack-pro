<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\ActivationLog;
use App\Models\Device;
use App\Models\License;
use RuntimeException;

/**
 * License lifecycle service: generation, signing, file export, activation,
 * verification and deactivation.
 *
 * A license file is a signed, encrypted binary payload carrying the full
 * license descriptor. The SDK reads and verifies it offline using the RSA
 * public key.
 *
 * @package App\Services
 */
final class LicenseService
{
    public function __construct(
        private License $licenses,
        private Device $devices,
        private ActivationLog $activationLogs,
        private EncryptionService $crypto,
        private FingerprintService $fingerprint
    ) {
    }

    /**
     * Duration in days for each license type (null = perpetual).
     *
     * @return array<string, int|null>
     */
    public static function typeDurations(): array
    {
        return [
            'trial'       => 14,
            'monthly'     => 30,
            'quarterly'   => 90,
            'semi_annual' => 182,
            'yearly'      => 365,
            'lifetime'    => null,
            'developer'   => 365,
            'enterprise'  => 365,
        ];
    }

    /**
     * Compute an expiry date from an issue date and license type.
     */
    public function computeExpiry(string $issueDate, string $type): ?string
    {
        $durations = self::typeDurations();
        $days      = $durations[$type] ?? 365;
        if ($days === null) {
            return null;
        }
        return date('Y-m-d', strtotime($issueDate . ' +' . $days . ' days'));
    }

    /**
     * Generate a unique, human-readable license number (e.g. PLM-2026-000123).
     */
    public function generateLicenseNumber(string $prefix = 'PLM'): string
    {
        do {
            $number = sprintf('%s-%s-%06d', $prefix, date('Y'), random_int(1, 999999));
        } while ($this->licenses->numberExists($number));

        return $number;
    }

    /**
     * Generate a formatted, unique license key (e.g. ABCDE-FGHIJ-...).
     */
    public function generateLicenseKey(): string
    {
        $segments = (int) config('license.key_segments', 5);
        $length   = (int) config('license.segment_length', 5);

        do {
            $parts = [];
            for ($i = 0; $i < $segments; $i++) {
                $parts[] = str_random($length);
            }
            $key = implode('-', $parts);
        } while ($this->licenses->keyExists($key));

        return $key;
    }

    /**
     * Build the canonical license descriptor used for signing.
     *
     * @param array<string, mixed> $license
     * @return array<string, mixed>
     */
    public function descriptor(array $license): array
    {
        return [
            'license_number' => $license['license_number'],
            'license_key'    => $license['license_key'],
            'customer_id'    => (int) $license['customer_id'],
            'product_id'     => (int) $license['product_id'],
            'type'           => $license['type'],
            'issue_date'     => $license['issue_date'],
            'expire_date'    => $license['expire_date'],
            'users_limit'    => (int) $license['users_limit'],
            'devices_limit'  => (int) $license['devices_limit'],
            'branches_limit' => (int) $license['branches_limit'],
            'modules'        => is_string($license['modules'] ?? null)
                ? json_decode((string) $license['modules'], true)
                : ($license['modules'] ?? []),
        ];
    }

    /**
     * Produce a digital signature and checksum for a license descriptor.
     *
     * @param array<string, mixed> $descriptor
     * @return array{signature: string, checksum: string}
     */
    public function signDescriptor(array $descriptor): array
    {
        $canonical = json_encode($descriptor, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($canonical === false) {
            throw new RuntimeException('Failed to serialise license descriptor.');
        }

        return [
            'signature' => $this->crypto->sign($canonical),
            'checksum'  => $this->crypto->checksum($canonical),
        ];
    }

    /**
     * Export a signed, encrypted license file payload.
     *
     * The container format is: MAGIC . base64(AES(JSON{descriptor, signature})).
     *
     * @param array<string, mixed> $license
     */
    public function buildLicenseFile(array $license): string
    {
        $descriptor = $this->descriptor($license);
        $canonical  = json_encode($descriptor, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $signature  = $license['signature'] ?? $this->crypto->sign((string) $canonical);

        $container = [
            'format'     => 'PLM-LICENSE',
            'version'    => 1,
            'issued_at'  => date('c'),
            'descriptor' => $descriptor,
            'signature'  => $signature,
            'public_key' => $this->crypto->publicKey(),
        ];

        $json      = json_encode($container, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $encrypted = $this->crypto->encrypt((string) $json);

        return config('license.file_magic', 'PLMLIC01') . "\n" . $encrypted;
    }

    /**
     * Parse and verify a license file payload, returning the descriptor.
     *
     * @return array<string, mixed>
     */
    public function readLicenseFile(string $payload): array
    {
        $magic = (string) config('license.file_magic', 'PLMLIC01');
        $parts = explode("\n", $payload, 2);

        if (count($parts) !== 2 || trim($parts[0]) !== $magic) {
            throw new RuntimeException('Invalid license file format.');
        }

        $json      = $this->crypto->decrypt(trim($parts[1]));
        $container = json_decode($json, true);

        if (!is_array($container) || !isset($container['descriptor'], $container['signature'])) {
            throw new RuntimeException('Corrupt license file.');
        }

        $canonical = json_encode($container['descriptor'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!$this->crypto->verify((string) $canonical, (string) $container['signature'])) {
            throw new RuntimeException('License signature verification failed.');
        }

        return $container['descriptor'];
    }

    /**
     * Activate a license on a device, enforcing device limits.
     *
     * @param array<string, string> $components Hardware identifiers.
     * @return array{status: string, message: string, device_id?: int}
     */
    public function activate(string $licenseKey, array $components, string $ip, string $userAgent): array
    {
        $license = $this->licenses->findByKey($licenseKey);

        if ($license === null) {
            $this->logActivation(null, null, null, 'activate', 'failed', 'License key not found', $ip, $userAgent);
            return ['status' => 'invalid', 'message' => 'License key not found.'];
        }

        if ($license['status'] !== 'active') {
            $this->logActivation((int) $license['id'], null, null, 'activate', 'failed', 'License is ' . $license['status'], $ip, $userAgent);
            return ['status' => $license['status'], 'message' => 'License is ' . $license['status'] . '.'];
        }

        if ($this->isExpired($license)) {
            $this->licenses->update((int) $license['id'], ['status' => 'expired']);
            $this->logActivation((int) $license['id'], null, null, 'activate', 'failed', 'License expired', $ip, $userAgent);
            return ['status' => 'expired', 'message' => 'License has expired.'];
        }

        $hash     = $this->fingerprint->generate($components);
        $existing = $this->devices->findByHash((int) $license['id'], $hash);

        if ($existing !== null) {
            if ($existing['status'] !== 'active') {
                return ['status' => 'blocked', 'message' => 'This device is blocked.'];
            }
            $this->devices->touch((int) $existing['id'], $ip);
            $this->logActivation((int) $license['id'], (int) $existing['id'], $hash, 'activate', 'success', 'Re-activation', $ip, $userAgent);
            return ['status' => 'active', 'message' => 'Device already activated.', 'device_id' => (int) $existing['id']];
        }

        $activeDevices = $this->devices->activeCount((int) $license['id']);
        if ($activeDevices >= (int) $license['devices_limit']) {
            $this->logActivation((int) $license['id'], null, $hash, 'reject', 'failed', 'Device limit reached', $ip, $userAgent);
            return ['status' => 'limit', 'message' => 'Device activation limit reached.'];
        }

        $extracted = $this->fingerprint->extract($components);
        $deviceId  = $this->devices->create(array_merge($extracted, [
            'license_id'    => (int) $license['id'],
            'device_name'   => (string) ($components['device_name'] ?? 'Unknown Device'),
            'hardware_hash' => $hash,
            'os_info'       => (string) ($components['os_info'] ?? ''),
            'ip_address'    => $ip,
            'status'        => 'active',
            'last_check_at' => date('Y-m-d H:i:s'),
        ]));

        $this->licenses->db()->execute(
            'UPDATE licenses SET activation_count = activation_count + 1 WHERE id = ?',
            [(int) $license['id']]
        );

        $this->logActivation((int) $license['id'], $deviceId, $hash, 'activate', 'success', 'New activation', $ip, $userAgent);

        return ['status' => 'active', 'message' => 'License activated successfully.', 'device_id' => $deviceId];
    }

    /**
     * Verify a license/device pairing.
     *
     * @param array<string, string> $components
     * @return array{valid: bool, status: string, message: string, days_remaining?: int|null, descriptor?: array<string,mixed>}
     */
    public function verify(string $licenseKey, array $components, string $ip, string $userAgent): array
    {
        $license = $this->licenses->findByKey($licenseKey);

        if ($license === null) {
            $this->logActivation(null, null, null, 'verify', 'failed', 'Not found', $ip, $userAgent);
            return ['valid' => false, 'status' => 'invalid', 'message' => 'License not found.'];
        }

        if ($this->isExpired($license) && $license['type'] !== 'lifetime') {
            if ($license['status'] === 'active') {
                $this->licenses->update((int) $license['id'], ['status' => 'expired']);
            }
            $this->logActivation((int) $license['id'], null, null, 'verify', 'failed', 'Expired', $ip, $userAgent);
            return ['valid' => false, 'status' => 'expired', 'message' => 'License expired.'];
        }

        if ($license['status'] !== 'active') {
            return ['valid' => false, 'status' => $license['status'], 'message' => 'License is ' . $license['status'] . '.'];
        }

        $hash   = $this->fingerprint->generate($components);
        $device = $this->devices->findByHash((int) $license['id'], $hash);

        if ($device === null) {
            $this->logActivation((int) $license['id'], null, $hash, 'verify', 'failed', 'Device not activated', $ip, $userAgent);
            return ['valid' => false, 'status' => 'unactivated', 'message' => 'Device is not activated for this license.'];
        }

        if ($device['status'] !== 'active') {
            return ['valid' => false, 'status' => 'blocked', 'message' => 'Device is blocked.'];
        }

        $this->devices->touch((int) $device['id'], $ip);
        $this->logActivation((int) $license['id'], (int) $device['id'], $hash, 'verify', 'success', 'Valid', $ip, $userAgent);

        return [
            'valid'          => true,
            'status'         => 'active',
            'message'        => 'License is valid.',
            'days_remaining' => $this->daysRemaining($license),
            'descriptor'     => $this->descriptor($license),
        ];
    }

    /**
     * Deactivate a device for a license.
     *
     * @param array<string, string> $components
     * @return array{status: string, message: string}
     */
    public function deactivate(string $licenseKey, array $components, string $ip, string $userAgent): array
    {
        $license = $this->licenses->findByKey($licenseKey);
        if ($license === null) {
            return ['status' => 'invalid', 'message' => 'License not found.'];
        }

        $hash   = $this->fingerprint->generate($components);
        $device = $this->devices->findByHash((int) $license['id'], $hash);
        if ($device === null) {
            return ['status' => 'not_found', 'message' => 'Device not found.'];
        }

        $this->devices->update((int) $device['id'], [
            'status'         => 'deactivated',
            'deactivated_at' => date('Y-m-d H:i:s'),
        ]);

        $this->logActivation((int) $license['id'], (int) $device['id'], $hash, 'deactivate', 'success', 'Deactivated', $ip, $userAgent);

        return ['status' => 'deactivated', 'message' => 'Device deactivated successfully.'];
    }

    /**
     * @param array<string, mixed> $license
     */
    public function isExpired(array $license): bool
    {
        if ($license['type'] === 'lifetime' || empty($license['expire_date'])) {
            return false;
        }
        return strtotime((string) $license['expire_date']) < strtotime(date('Y-m-d'));
    }

    /**
     * @param array<string, mixed> $license
     */
    public function daysRemaining(array $license): ?int
    {
        if ($license['type'] === 'lifetime' || empty($license['expire_date'])) {
            return null;
        }
        return (int) floor((strtotime((string) $license['expire_date']) - strtotime(date('Y-m-d'))) / 86400);
    }

    private function logActivation(
        ?int $licenseId,
        ?int $deviceId,
        ?string $hash,
        string $action,
        string $result,
        string $message,
        string $ip,
        string $userAgent
    ): void {
        $this->activationLogs->create([
            'license_id'    => $licenseId,
            'device_id'     => $deviceId,
            'hardware_hash' => $hash,
            'action'        => $action,
            'result'        => $result,
            'message'       => $message,
            'ip_address'    => $ip,
            'user_agent'    => mb_substr($userAgent, 0, 255),
        ]);
    }
}
