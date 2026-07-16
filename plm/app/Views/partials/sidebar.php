<?php
/**
 * Sidebar navigation.
 *
 * @var App\Core\Auth $auth
 * @var string $active
 */
$active = $active ?? '';
$nav = [
    ['key' => 'dashboard', 'label' => 'Dashboard', 'icon' => 'grid', 'url' => url('dashboard'), 'perm' => null],
    ['key' => 'customers', 'label' => 'Customers', 'icon' => 'people', 'url' => url('customers'), 'perm' => 'customers.view'],
    ['key' => 'products', 'label' => 'Products', 'icon' => 'box', 'url' => url('products'), 'perm' => 'products.view'],
    ['key' => 'versions', 'label' => 'Versions', 'icon' => 'layers', 'url' => url('versions'), 'perm' => 'products.view'],
    ['key' => 'licenses', 'label' => 'Licenses', 'icon' => 'key', 'url' => url('licenses'), 'perm' => 'licenses.view'],
    ['key' => 'devices', 'label' => 'Devices', 'icon' => 'cpu', 'url' => url('devices'), 'perm' => 'devices.view'],
    ['key' => 'reports', 'label' => 'Reports', 'icon' => 'chart', 'url' => url('reports'), 'perm' => 'reports.view'],
    ['key' => 'users', 'label' => 'Users', 'icon' => 'user', 'url' => url('users'), 'perm' => 'users.view'],
    ['key' => 'roles', 'label' => 'Roles', 'icon' => 'shield', 'url' => url('roles'), 'perm' => 'roles.view'],
    ['key' => 'audit', 'label' => 'Audit Logs', 'icon' => 'list', 'url' => url('audit'), 'perm' => 'audit.view'],
    ['key' => 'settings', 'label' => 'Settings', 'icon' => 'gear', 'url' => url('settings'), 'perm' => 'settings.view'],
];
?>
<aside class="app-sidebar" id="appSidebar">
    <div class="sidebar-brand">
        <a href="<?= url('dashboard') ?>" class="brand-link">
            <span class="brand-logo"><?= icon('key') ?></span>
            <span class="brand-text">Prima <small>LM</small></span>
        </a>
        <button class="sidebar-close d-lg-none" id="sidebarClose" aria-label="Close">&times;</button>
    </div>

    <nav class="sidebar-nav">
        <ul class="nav-list">
            <?php foreach ($nav as $item): ?>
                <?php if ($item['perm'] === null || $auth->can($item['perm'])): ?>
                <li class="nav-item">
                    <a href="<?= e($item['url']) ?>" class="nav-link <?= $active === $item['key'] ? 'active' : '' ?>">
                        <span class="nav-icon"><?= icon($item['icon']) ?></span>
                        <span class="nav-text"><?= e(__($item['label'])) ?></span>
                    </a>
                </li>
                <?php endif; ?>
            <?php endforeach; ?>
        </ul>
    </nav>

    <div class="sidebar-footer">
        <a href="<?= url('backups') ?>" class="nav-link <?= $active === 'backups' ? 'active' : '' ?>">
            <span class="nav-icon"><?= icon('database') ?></span>
            <span class="nav-text"><?= e(__('Backups')) ?></span>
        </a>
    </div>
</aside>
<div class="sidebar-overlay" id="sidebarOverlay"></div>
