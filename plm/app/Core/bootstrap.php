<?php

declare(strict_types=1);

/**
 * Framework bootstrap.
 *
 * Registers autoloading (Composer if available, otherwise the built-in PSR-4
 * autoloader) and returns a configured application kernel.
 */

use App\Core\App;
use App\Core\Autoloader;

$root = dirname(__DIR__, 2);

// Prefer Composer's autoloader when the vendor directory has been built.
$composerAutoload = $root . '/vendor/autoload.php';
if (is_readable($composerAutoload)) {
    require $composerAutoload;
} else {
    // Fallback: self-contained PSR-4 autoloader.
    require __DIR__ . '/Autoloader.php';
    $autoloader = new Autoloader();
    $autoloader->addNamespace('App\\', $root . '/app');
    $autoloader->addNamespace('Prima\\LicenseSDK\\', $root . '/app/LicenseSDK');
    $autoloader->register();
    require $root . '/app/Helpers/functions.php';
}

return new App();
