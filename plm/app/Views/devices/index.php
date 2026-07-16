<?php
/**
 * Devices listing.
 *
 * @var array<int,array<string,mixed>> $devices
 * @var int $total
 * @var int $page
 * @var int $pages
 * @var App\Core\Auth $auth
 * @var App\Core\Csrf $csrf
 */
?>
<div class="card">
    <div class="card-body">
        <div class="table-responsive">
            <table class="table table-hover align-middle">
                <thead><tr><th>Device</th><th>Customer</th><th>License</th><th>Hardware Hash</th><th>Activated</th><th>Status</th><th class="text-end">Actions</th></tr></thead>
                <tbody>
                    <?php foreach ($devices as $d): ?>
                    <tr>
                        <td><?= e($d['device_name'] ?: 'Unknown') ?><br><small class="text-muted"><?= e($d['os_info'] ?: '') ?></small></td>
                        <td><?= e($d['customer_name']) ?></td>
                        <td><a href="<?= url('licenses/' . $d['license_id']) ?>" class="mono text-decoration-none"><?= e($d['license_number']) ?></a></td>
                        <td><span class="mono" title="<?= e($d['hardware_hash']) ?>"><?= e(substr($d['hardware_hash'], 0, 20)) ?>…</span></td>
                        <td><?= human_date($d['activated_at'], 'Y-m-d H:i') ?></td>
                        <td><span class="badge <?= status_badge($d['status']) ?>"><?= e(ucfirst($d['status'])) ?></span></td>
                        <td class="text-end">
                            <?php if ($auth->can('devices.manage')): ?>
                                <?php if ($d['status'] === 'active'): ?>
                                    <form method="post" action="<?= url('devices/' . $d['id'] . '/block') ?>" class="d-inline"><?= $csrf->field() ?><button class="btn btn-sm btn-outline-warning">Block</button></form>
                                <?php else: ?>
                                    <form method="post" action="<?= url('devices/' . $d['id'] . '/unblock') ?>" class="d-inline"><?= $csrf->field() ?><button class="btn btn-sm btn-outline-success">Unblock</button></form>
                                <?php endif; ?>
                                <form method="post" action="<?= url('devices/' . $d['id'] . '/delete') ?>" class="d-inline" data-confirm="Remove this device?"><?= $csrf->field() ?><button class="btn btn-sm btn-outline-danger">Remove</button></form>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                    <?php if ($devices === []): ?><tr><td colspan="7" class="empty-state">No devices activated yet.</td></tr><?php endif; ?>
                </tbody>
            </table>
        </div>
        <?php $result = ['total' => $total, 'page' => $page, 'per_page' => $perPage, 'pages' => $pages]; include dirname(__DIR__) . '/partials/pagination.php'; ?>
    </div>
</div>
