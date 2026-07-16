<?php

declare(strict_types=1);

use App\Core\Router;
use App\Controllers\AuthController;
use App\Controllers\DashboardController;
use App\Controllers\CustomerController;
use App\Controllers\ProductController;
use App\Controllers\VersionController;
use App\Controllers\LicenseController;
use App\Controllers\DeviceController;
use App\Controllers\UserController;
use App\Controllers\RoleController;
use App\Controllers\AuditController;
use App\Controllers\ReportController;
use App\Controllers\SettingsController;
use App\Controllers\BackupController;
use App\Controllers\ProfileController;
use App\Controllers\NotificationController;
use App\Controllers\InstallerController;
use App\Middleware\AuthMiddleware;
use App\Middleware\GuestMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Middleware\PermissionMiddleware;

/**
 * Web route registration.
 *
 * @return callable(Router):void
 */
return static function (Router $router): void {
    $auth  = [AuthMiddleware::class];
    $guest = [GuestMiddleware::class];
    $write = [AuthMiddleware::class, CsrfMiddleware::class, PermissionMiddleware::class];
    $read  = [AuthMiddleware::class, PermissionMiddleware::class];

    // ---- Installer ----
    $router->get('/install', [InstallerController::class, 'index']);
    $router->get('/install/step/{step}', [InstallerController::class, 'step']);
    $router->post('/install/requirements', [InstallerController::class, 'requirements']);
    $router->post('/install/database', [InstallerController::class, 'database']);
    $router->post('/install/admin', [InstallerController::class, 'admin']);
    $router->post('/install/keys', [InstallerController::class, 'keys']);
    $router->post('/install/finish', [InstallerController::class, 'finish']);

    // ---- Authentication ----
    $router->get('/login', [AuthController::class, 'showLogin'], $guest);
    $router->post('/login', [AuthController::class, 'login'], [GuestMiddleware::class, CsrfMiddleware::class]);
    $router->post('/logout', [AuthController::class, 'logout'], [AuthMiddleware::class, CsrfMiddleware::class]);
    $router->get('/', [AuthController::class, 'root']);

    // ---- Dashboard ----
    $router->get('/dashboard', [DashboardController::class, 'index'], $auth);
    $router->get('/dashboard/chart-data', [DashboardController::class, 'chartData'], $auth);

    // ---- Customers ----
    $router->get('/customers', [CustomerController::class, 'index'], $read);
    $router->get('/customers/create', [CustomerController::class, 'create'], $read);
    $router->post('/customers', [CustomerController::class, 'store'], $write);
    $router->get('/customers/{id}', [CustomerController::class, 'show'], $read);
    $router->get('/customers/{id}/edit', [CustomerController::class, 'edit'], $read);
    $router->post('/customers/{id}/update', [CustomerController::class, 'update'], $write);
    $router->post('/customers/{id}/delete', [CustomerController::class, 'destroy'], $write);

    // ---- Products ----
    $router->get('/products', [ProductController::class, 'index'], $read);
    $router->get('/products/create', [ProductController::class, 'create'], $read);
    $router->post('/products', [ProductController::class, 'store'], $write);
    $router->get('/products/{id}', [ProductController::class, 'show'], $read);
    $router->get('/products/{id}/edit', [ProductController::class, 'edit'], $read);
    $router->post('/products/{id}/update', [ProductController::class, 'update'], $write);
    $router->post('/products/{id}/delete', [ProductController::class, 'destroy'], $write);

    // ---- Software Versions ----
    $router->get('/versions', [VersionController::class, 'index'], $read);
    $router->get('/versions/create', [VersionController::class, 'create'], $read);
    $router->post('/versions', [VersionController::class, 'store'], $write);
    $router->get('/versions/{id}/edit', [VersionController::class, 'edit'], $read);
    $router->post('/versions/{id}/update', [VersionController::class, 'update'], $write);
    $router->post('/versions/{id}/delete', [VersionController::class, 'destroy'], $write);

    // ---- Licenses ----
    $router->get('/licenses', [LicenseController::class, 'index'], $read);
    $router->get('/licenses/create', [LicenseController::class, 'create'], $read);
    $router->post('/licenses', [LicenseController::class, 'store'], $write);
    $router->get('/licenses/{id}', [LicenseController::class, 'show'], $read);
    $router->get('/licenses/{id}/edit', [LicenseController::class, 'edit'], $read);
    $router->post('/licenses/{id}/update', [LicenseController::class, 'update'], $write);
    $router->post('/licenses/{id}/delete', [LicenseController::class, 'destroy'], $write);
    $router->post('/licenses/{id}/revoke', [LicenseController::class, 'revoke'], $write);
    $router->post('/licenses/{id}/renew', [LicenseController::class, 'renew'], $write);
    $router->get('/licenses/{id}/download/{format}', [LicenseController::class, 'download'], $read);
    $router->get('/licenses/{id}/qr', [LicenseController::class, 'qr'], $read);
    $router->get('/licenses/{id}/print', [LicenseController::class, 'printCertificate'], $read);

    // ---- Devices ----
    $router->get('/devices', [DeviceController::class, 'index'], $read);
    $router->post('/devices/{id}/block', [DeviceController::class, 'block'], $write);
    $router->post('/devices/{id}/unblock', [DeviceController::class, 'unblock'], $write);
    $router->post('/devices/{id}/delete', [DeviceController::class, 'destroy'], $write);

    // ---- Users ----
    $router->get('/users', [UserController::class, 'index'], $read);
    $router->get('/users/create', [UserController::class, 'create'], $read);
    $router->post('/users', [UserController::class, 'store'], $write);
    $router->get('/users/{id}/edit', [UserController::class, 'edit'], $read);
    $router->post('/users/{id}/update', [UserController::class, 'update'], $write);
    $router->post('/users/{id}/delete', [UserController::class, 'destroy'], $write);

    // ---- Roles ----
    $router->get('/roles', [RoleController::class, 'index'], $read);
    $router->get('/roles/create', [RoleController::class, 'create'], $read);
    $router->post('/roles', [RoleController::class, 'store'], $write);
    $router->get('/roles/{id}/edit', [RoleController::class, 'edit'], $read);
    $router->post('/roles/{id}/update', [RoleController::class, 'update'], $write);
    $router->post('/roles/{id}/delete', [RoleController::class, 'destroy'], $write);

    // ---- Audit Logs ----
    $router->get('/audit', [AuditController::class, 'index'], $read);

    // ---- Reports ----
    $router->get('/reports', [ReportController::class, 'index'], $read);
    $router->get('/reports/{type}', [ReportController::class, 'show'], $read);
    $router->get('/reports/{type}/export/{format}', [ReportController::class, 'export'], $read);

    // ---- Settings ----
    $router->get('/settings', [SettingsController::class, 'index'], $read);
    $router->post('/settings', [SettingsController::class, 'update'], $write);
    $router->post('/settings/test-mail', [SettingsController::class, 'testMail'], $write);
    $router->post('/settings/regenerate-keys', [SettingsController::class, 'regenerateKeys'], $write);

    // ---- Backups ----
    $router->get('/backups', [BackupController::class, 'index'], $read);
    $router->post('/backups/database', [BackupController::class, 'backupDatabase'], $write);
    $router->post('/backups/files', [BackupController::class, 'backupFiles'], $write);
    $router->get('/backups/{filename}/download', [BackupController::class, 'download'], $read);
    $router->post('/backups/{filename}/delete', [BackupController::class, 'destroy'], $write);
    $router->post('/backups/restore', [BackupController::class, 'restore'], $write);

    // ---- Profile ----
    $router->get('/profile', [ProfileController::class, 'index'], $auth);
    $router->post('/profile', [ProfileController::class, 'update'], [AuthMiddleware::class, CsrfMiddleware::class]);
    $router->post('/profile/password', [ProfileController::class, 'changePassword'], [AuthMiddleware::class, CsrfMiddleware::class]);
    $router->post('/profile/preferences', [ProfileController::class, 'preferences'], [AuthMiddleware::class, CsrfMiddleware::class]);

    // ---- Notifications ----
    $router->get('/notifications', [NotificationController::class, 'index'], $auth);
    $router->post('/notifications/{id}/read', [NotificationController::class, 'markRead'], [AuthMiddleware::class, CsrfMiddleware::class]);
    $router->post('/notifications/read-all', [NotificationController::class, 'markAllRead'], [AuthMiddleware::class, CsrfMiddleware::class]);
};
