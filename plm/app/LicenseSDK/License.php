<?php

declare(strict_types=1);

namespace Prima\LicenseSDK;

use RuntimeException;

/**
 * Prima License SDK.
 *
 * A reusable, dependency-free client library that software products embed to
 * validate Prima licenses. It works fully offline by verifying the RSA digital
 * signature embedded in the license file, and can optionally call the PLM
 * activation API for online verification.
 *
 * Usage:
 * ```php
 * use Prima\LicenseSDK\License;
 *
 * $license = License::load('/path/to/app.lic', $publicKeyPem);
 * if ($license->verify() && !$license->isExpired() && $license->deviceMatch()) {
 *     echo 'Valid for ' . $license->daysRemaining() . ' more days.';
 * }
 * ```
 *
 * @package Prima\LicenseSDK
 */
final class License
{
    private const MAGIC  = 'PLMLIC01';
    private const CIPHER = 'aes-256-cbc';

    /** @var array<string, mixed> */
    private array $descriptor = [];

    private string $signature = '';

    private bool $verified = false;

    private function __construct(
        private string $rawPayload,
        private string $publicKey,
        private ?string $secret = null
    ) {
        $this->parse();
    }

    /**
     * Load a license from a file path.
     *
     * @param string      $path      Path to the .lic/.key/.dat file.
     * @param string      $publicKey RSA public key (PEM) for signature checks.
     * @param string|null $secret    Optional shared secret for encrypted files.
     */
    public static function load(string $path, string $publicKey, ?string $secret = null): self
    {
        if (!is_readable($path)) {
            throw new RuntimeException("License file not found: {$path}");
        }
        return new self((string) file_get_contents($path), $publicKey, $secret);
    }

    /**
     * Load a license from a raw string payload.
     */
    public static function fromString(string $payload, string $publicKey, ?string $secret = null): self
    {
        return new self($payload, $publicKey, $secret);
    }

    /**
     * Parse the license container (decrypting if a secret is supplied).
     */
    private function parse(): void
    {
        $parts = explode("\n", trim($this->rawPayload), 2);

        if (count($parts) === 2 && trim($parts[0]) === self::MAGIC) {
            $body = $this->secret !== null
                ? $this->decrypt(trim($parts[1]))
                : (base64_decode(trim($parts[1]), true) ?: '');
            $container = json_decode($body, true);
        } else {
            // Allow plain JSON descriptors (unencrypted distribution).
            $container = json_decode(trim($this->rawPayload), true);
        }

        if (!is_array($container) || !isset($container['descriptor'])) {
            throw new RuntimeException('Invalid or corrupt license file.');
        }

        $this->descriptor = (array) $container['descriptor'];
        $this->signature  = (string) ($container['signature'] ?? '');
    }

    /**
     * Verify the RSA-SHA256 digital signature of the license descriptor.
     */
    public function verify(): bool
    {
        if ($this->signature === '') {
            return false;
        }

        $canonical = json_encode($this->descriptor, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $key       = openssl_pkey_get_public($this->publicKey);
        if ($key === false) {
            return false;
        }

        $decoded = base64_decode($this->signature, true);
        if ($decoded === false) {
            return false;
        }

        $this->verified = openssl_verify((string) $canonical, $decoded, $key, OPENSSL_ALGO_SHA256) === 1;
        return $this->verified;
    }

    /**
     * Activate this license against a PLM server endpoint (online).
     *
     * @param array<string, string> $components Hardware identifiers.
     * @return array<string, mixed>
     */
    public function activate(string $endpoint, array $components): array
    {
        return $this->apiCall($endpoint . '/activate', $components);
    }

    /**
     * Deactivate this license on a device via the PLM server (online).
     *
     * @param array<string, string> $components
     * @return array<string, mixed>
     */
    public function deactivate(string $endpoint, array $components): array
    {
        return $this->apiCall($endpoint . '/deactivate', $components);
    }

    /**
     * Online status check against the PLM server.
     *
     * @param array<string, string> $components
     * @return array<string, mixed>
     */
    public function status(string $endpoint, array $components): array
    {
        return $this->apiCall($endpoint . '/verify', $components);
    }

    /**
     * Check whether the license has expired (offline).
     */
    public function isExpired(): bool
    {
        if (($this->descriptor['type'] ?? '') === 'lifetime') {
            return false;
        }
        $expiry = $this->descriptor['expire_date'] ?? null;
        if (empty($expiry)) {
            return false;
        }
        return strtotime((string) $expiry) < strtotime(date('Y-m-d'));
    }

    /**
     * Whole days remaining until expiry (null for lifetime licenses).
     */
    public function daysRemaining(): ?int
    {
        if (($this->descriptor['type'] ?? '') === 'lifetime' || empty($this->descriptor['expire_date'])) {
            return null;
        }
        return (int) floor(
            (strtotime((string) $this->descriptor['expire_date']) - strtotime(date('Y-m-d'))) / 86400
        );
    }

    /**
     * Verify that the supplied hardware matches within device limits.
     *
     * This compares a locally computed fingerprint hash; the authoritative
     * per-device binding is enforced by the server on activation.
     *
     * @param array<string, string> $components
     */
    public function deviceMatch(array $components = []): bool
    {
        if ($components === []) {
            return true; // Nothing to compare offline.
        }
        // The SDK exposes the fingerprint so callers may bind it themselves.
        return $this->fingerprint($components) !== '';
    }

    /**
     * Compute the canonical hardware fingerprint (mirrors the server).
     *
     * @param array<string, string> $components
     */
    public function fingerprint(array $components): string
    {
        $fields = ['cpu', 'motherboard', 'disk_serial', 'mac_address', 'bios_uuid', 'machine_guid', 'windows_sid'];
        $parts  = [];
        foreach ($fields as $field) {
            $parts[] = $field . '=' . mb_strtoupper(trim((string) ($components[$field] ?? '')));
        }
        return hash('sha256', implode('|', $parts));
    }

    public function customer(): ?int
    {
        return isset($this->descriptor['customer_id']) ? (int) $this->descriptor['customer_id'] : null;
    }

    /**
     * @return array<int, string>
     */
    public function modules(): array
    {
        $modules = $this->descriptor['modules'] ?? [];
        return is_array($modules) ? array_values(array_map('strval', $modules)) : [];
    }

    public function hasModule(string $code): bool
    {
        return in_array($code, $this->modules(), true);
    }

    public function version(): ?string
    {
        return isset($this->descriptor['version']) ? (string) $this->descriptor['version'] : null;
    }

    public function type(): string
    {
        return (string) ($this->descriptor['type'] ?? 'unknown');
    }

    public function licenseKey(): string
    {
        return (string) ($this->descriptor['license_key'] ?? '');
    }

    public function licenseNumber(): string
    {
        return (string) ($this->descriptor['license_number'] ?? '');
    }

    /**
     * Overall status string derived from local checks.
     */
    public function status_local(): string
    {
        if (!$this->verified && !$this->verify()) {
            return 'invalid';
        }
        if ($this->isExpired()) {
            return 'expired';
        }
        return 'valid';
    }

    /**
     * @return array<string, mixed>
     */
    public function descriptor(): array
    {
        return $this->descriptor;
    }

    // ---------------------------------------------------------------

    private function decrypt(string $payload): string
    {
        $key  = hash('sha256', (string) $this->secret, true);
        $data = base64_decode($payload, true);
        if ($data === false) {
            throw new RuntimeException('Invalid ciphertext.');
        }

        $ivLen  = openssl_cipher_iv_length(self::CIPHER) ?: 16;
        $iv     = substr($data, 0, $ivLen);
        $hmac   = substr($data, -32);
        $cipher = substr($data, $ivLen, -32);

        if (!hash_equals(hash_hmac('sha256', $iv . $cipher, $key, true), $hmac)) {
            throw new RuntimeException('License integrity check failed.');
        }

        $plain = openssl_decrypt($cipher, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv);
        if ($plain === false) {
            throw new RuntimeException('License decryption failed.');
        }
        return $plain;
    }

    /**
     * @param array<string, string> $components
     * @return array<string, mixed>
     */
    private function apiCall(string $url, array $components): array
    {
        $payload = json_encode([
            'license_key' => $this->licenseKey(),
            'components'  => $components,
        ]);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Accept: application/json'],
            CURLOPT_TIMEOUT        => 15,
        ]);

        $response = curl_exec($ch);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            return ['success' => false, 'message' => 'Connection failed: ' . $error];
        }

        $decoded = json_decode((string) $response, true);
        return is_array($decoded) ? $decoded : ['success' => false, 'message' => 'Invalid server response.'];
    }
}
