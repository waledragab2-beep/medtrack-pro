<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Hardware fingerprint service.
 *
 * Computes a stable SHA-256 hardware hash from a set of hardware identifiers
 * (CPU, motherboard, disk serial, MAC address, BIOS UUID, machine GUID). The
 * same algorithm is mirrored in the LicenseSDK so client devices and the
 * server produce identical fingerprints.
 *
 * @package App\Services
 */
final class FingerprintService
{
    /** @var string[] Identifier fields in canonical order. */
    private const FIELDS = [
        'cpu', 'motherboard', 'disk_serial', 'mac_address',
        'bios_uuid', 'machine_guid', 'windows_sid',
    ];

    /**
     * Generate a hardware fingerprint hash from raw identifiers.
     *
     * @param array<string, mixed> $components
     */
    public function generate(array $components): string
    {
        $parts = [];
        foreach (self::FIELDS as $field) {
            $value  = trim((string) ($components[$field] ?? ''));
            $parts[] = $field . '=' . mb_strtoupper($value);
        }

        $canonical = implode('|', $parts);
        return hash('sha256', $canonical);
    }

    /**
     * Compare a stored hardware hash against submitted components.
     */
    public function matches(string $storedHash, array $components): bool
    {
        return hash_equals($storedHash, $this->generate($components));
    }

    /**
     * Extract only recognised fingerprint fields from an input array.
     *
     * @param array<string, mixed> $input
     * @return array<string, string>
     */
    public function extract(array $input): array
    {
        $out = [];
        foreach (self::FIELDS as $field) {
            $out[$field] = trim((string) ($input[$field] ?? ''));
        }
        return $out;
    }
}
