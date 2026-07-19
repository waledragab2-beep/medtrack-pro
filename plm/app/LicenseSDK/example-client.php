<?php

declare(strict_types=1);

/**
 * Prima License SDK — example client.
 *
 * Demonstrates offline verification and (optionally) online activation of a
 * license file. Adapt the hardware-collection helpers to your platform.
 *
 * Run:  php example-client.php /path/to/app.lic /path/to/public.pem
 */

require __DIR__ . '/License.php';

use Prima\LicenseSDK\License;

$licenseFile = $argv[1] ?? (__DIR__ . '/app.lic');
$publicKeyFile = $argv[2] ?? (__DIR__ . '/public.pem');

if (!is_readable($licenseFile) || !is_readable($publicKeyFile)) {
    fwrite(STDERR, "Usage: php example-client.php <license.lic> <public.pem>\n");
    exit(1);
}

$publicKey = (string) file_get_contents($publicKeyFile);
$license   = License::load($licenseFile, $publicKey);

echo "== Prima License SDK — Client Check ==\n";
echo 'License number : ' . $license->licenseNumber() . "\n";
echo 'License key     : ' . $license->licenseKey() . "\n";
echo 'Type            : ' . $license->type() . "\n";
echo 'Signature valid : ' . ($license->verify() ? 'YES' : 'NO') . "\n";
echo 'Expired         : ' . ($license->isExpired() ? 'YES' : 'NO') . "\n";
echo 'Days remaining  : ' . ($license->daysRemaining() ?? 'lifetime') . "\n";
echo 'Modules         : ' . implode(', ', $license->modules()) . "\n";
echo 'Overall status  : ' . $license->status_local() . "\n";

/**
 * Collect hardware identifiers. These helpers are best-effort and
 * cross-platform; replace them with platform-native calls (WMIC/dmidecode)
 * for production hardware binding.
 */
function collectHardware(): array
{
    $mac = '';
    if (function_exists('shell_exec')) {
        $out = @shell_exec(stripos(PHP_OS, 'WIN') === 0 ? 'getmac' : 'ip link 2>/dev/null || ifconfig 2>/dev/null');
        if ($out && preg_match('/([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}/', $out, $m)) {
            $mac = $m[0];
        }
    }

    return [
        'cpu'          => (string) (php_uname('m') . '-' . (php_uname('p') ?: 'cpu')),
        'motherboard'  => php_uname('n'),
        'disk_serial'  => hash('crc32b', __DIR__),
        'mac_address'  => $mac,
        'bios_uuid'    => '',
        'machine_guid' => php_uname('s') . '-' . php_uname('r'),
        'device_name'  => gethostname() ?: 'device',
        'os_info'      => php_uname(),
    ];
}

$components = collectHardware();
echo "\nLocal fingerprint: " . $license->fingerprint($components) . "\n";

// Uncomment to perform online activation against your PLM server:
//
// $endpoint = 'https://your-domain/api/v1/licenses';
// $result   = $license->activate($endpoint, $components);
// echo "Activation: " . json_encode($result, JSON_PRETTY_PRINT) . "\n";
