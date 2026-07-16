# Prima License SDK

A reusable, dependency-free PHP client for validating Prima licenses inside
your own software products. Requires only PHP 8.0+ with the `openssl`
extension.

## Installation

Copy `License.php` into your product, or require it via Composer using the
`Prima\LicenseSDK\` namespace.

```php
require 'License.php';
use Prima\LicenseSDK\License;
```

## Offline verification

Offline verification relies on the RSA-4096 public key of the PLM server that
issued the license. Fetch it once from `GET /api/v1/public-key` (or bundle it
with your product) and store it as `public.pem`.

```php
$publicKey = file_get_contents(__DIR__ . '/public.pem');
$license   = License::load(__DIR__ . '/app.lic', $publicKey);

if (!$license->verify()) {
    exit('Invalid or tampered license.');
}
if ($license->isExpired()) {
    exit('License expired.');
}

echo 'Type: ' . $license->type() . PHP_EOL;
echo 'Customer: #' . $license->customer() . PHP_EOL;
echo 'Modules: ' . implode(', ', $license->modules()) . PHP_EOL;
echo 'Days remaining: ' . ($license->daysRemaining() ?? 'lifetime') . PHP_EOL;

if ($license->hasModule('EINV')) {
    // Enable the e-invoicing feature.
}
```

## Online activation & verification

For device-bound licensing, call the PLM REST API. The SDK computes the same
SHA-256 hardware fingerprint as the server.

```php
$components = [
    'cpu'          => getCpuId(),
    'motherboard'  => getMotherboardSerial(),
    'disk_serial'  => getDiskSerial(),
    'mac_address'  => getMacAddress(),
    'bios_uuid'    => getBiosUuid(),
    'machine_guid' => getMachineGuid(),
    'device_name'  => gethostname(),
    'os_info'      => php_uname(),
];

$endpoint = 'https://your-domain/api/v1/licenses';

$activation = $license->activate($endpoint, $components);
// => ['success' => true, 'status' => 'active', 'message' => '…', 'device_id' => 12]

$status = $license->status($endpoint, $components);
// => ['valid' => true, 'status' => 'active', 'days_remaining' => 340, …]

$license->deactivate($endpoint, $components);
```

## API reference

| Method | Description |
|--------|-------------|
| `License::load($path, $publicKey, $secret = null)` | Load a license from a file. |
| `License::fromString($payload, $publicKey, $secret = null)` | Load from a raw payload. |
| `verify()` | Verify the RSA digital signature. |
| `isExpired()` | True if past the expiry date (false for lifetime). |
| `daysRemaining()` | Whole days until expiry, or null for lifetime. |
| `deviceMatch($components)` | Local hardware sanity check. |
| `fingerprint($components)` | Compute the SHA-256 hardware hash. |
| `customer()` | Customer ID from the descriptor. |
| `modules()` / `hasModule($code)` | Licensed feature modules. |
| `version()` / `type()` | License metadata. |
| `licenseKey()` / `licenseNumber()` | Identifiers. |
| `status_local()` | `valid` \| `expired` \| `invalid` (offline). |
| `activate()` / `status()` / `deactivate()` | Online API operations. |

See `example-client.php` for a runnable demonstration.
