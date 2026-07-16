<?php
/**
 * License detail view.
 *
 * @var array<string,mixed> $license
 * @var array<int,array<string,mixed>> $devices
 * @var string $qr
 * @var string $verifyUrl
 * @var int|null $daysLeft
 * @var App\Core\Auth $auth
 * @var App\Core\Csrf $csrf
 */
$modules = json_decode((string) ($license['modules'] ?? '[]'), true) ?: [];
?>
<div class="row g-4">
    <div class="col-lg-8">
        <div class="card mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
                <div>
                    <h5 class="mb-0 mono"><?= e($license['license_number']) ?></h5>
                    <small class="text-muted"><?= e($license['customer_name']) ?> · <?= e($license['product_name']) ?></small>
                </div>
                <span class="badge <?= status_badge($license['status']) ?> fs-6"><?= e(__(ucfirst($license['status']))) ?></span>
            </div>
            <div class="card-body">
                <div class="mb-3">
                    <label class="form-label"><?= e(__('License Key')) ?></label>
                    <div class="input-group">
                        <input class="form-control mono" value="<?= e($license['license_key']) ?>" readonly>
                        <button class="btn btn-outline-secondary" type="button" data-copy="<?= e($license['license_key']) ?>"><?= e(__('Copy')) ?></button>
                    </div>
                </div>
                <div class="detail-list">
                    <div class="detail-item"><label><?= e(__('Type')) ?></label><span><?= e(__(ucwords(str_replace('_', ' ', $license['type'])))) ?></span></div>
                    <div class="detail-item"><label><?= e(__('Version')) ?></label><span><?= e($license['version_number'] ?: 'Any') ?></span></div>
                    <div class="detail-item"><label><?= e(__('Issue Date')) ?></label><span><?= human_date($license['issue_date']) ?></span></div>
                    <div class="detail-item"><label><?= e(__('Expiry Date')) ?></label><span><?= $license['expire_date'] ? human_date($license['expire_date']) : 'Lifetime' ?><?php if ($daysLeft !== null): ?> <small class="<?= $daysLeft < 0 ? 'text-danger' : 'text-muted' ?>">(<?= $daysLeft ?>d)</small><?php endif; ?></span></div>
                    <div class="detail-item"><label><?= e(__('Users Limit')) ?></label><span><?= (int) $license['users_limit'] ?></span></div>
                    <div class="detail-item"><label><?= e(__('Devices Limit')) ?></label><span><?= (int) $license['activation_count'] ?> / <?= (int) $license['devices_limit'] ?></span></div>
                    <div class="detail-item"><label><?= e(__('Branches Limit')) ?></label><span><?= (int) $license['branches_limit'] ?></span></div>
                    <div class="detail-item"><label><?= e(__('Price')) ?></label><span><?= e($license['currency']) ?> <?= number_format((float) $license['price'], 2) ?></span></div>
                </div>
                <?php if ($modules): ?>
                    <hr><label class="form-label"><?= e(__('Licensed Modules')) ?></label><br>
                    <?php foreach ($modules as $mod): ?><span class="badge bg-primary me-1"><?= e($mod) ?></span><?php endforeach; ?>
                <?php endif; ?>
                <?php if (!empty($license['notes'])): ?><hr><p class="text-muted small mb-0"><?= nl2br(e($license['notes'])) ?></p><?php endif; ?>
            </div>
        </div>

        <div class="card">
            <div class="card-header"><h5 class="mb-0">Activated Devices (<?= count($devices) ?>)</h5></div>
            <div class="table-responsive">
                <table class="table table-hover mb-0 align-middle">
                    <thead><tr><th><?= e(__('Device')) ?></th><th><?= e(__('Hardware Hash')) ?></th><th><?= e(__('Activated')) ?></th><th><?= e(__('Last Check')) ?></th><th><?= e(__('Status')) ?></th><th></th></tr></thead>
                    <tbody>
                        <?php foreach ($devices as $d): ?>
                        <tr>
                            <td><?= e($d['device_name'] ?: 'Unknown') ?><br><small class="text-muted"><?= e($d['os_info'] ?: '') ?></small></td>
                            <td><span class="mono" title="<?= e($d['hardware_hash']) ?>"><?= e(substr($d['hardware_hash'], 0, 16)) ?>…</span></td>
                            <td><?= human_date($d['activated_at'], 'Y-m-d H:i') ?></td>
                            <td><?= $d['last_check_at'] ? human_date($d['last_check_at'], 'Y-m-d H:i') : '—' ?></td>
                            <td><span class="badge <?= status_badge($d['status']) ?>"><?= e(__(ucfirst($d['status']))) ?></span></td>
                            <td class="text-end">
                                <?php if ($auth->can('devices.manage')): ?>
                                    <?php if ($d['status'] === 'active'): ?>
                                        <form method="post" action="<?= url('devices/' . $d['id'] . '/block') ?>" class="d-inline"><?= $csrf->field() ?><button class="btn btn-sm btn-outline-warning"><?= e(__('Block')) ?></button></form>
                                    <?php else: ?>
                                        <form method="post" action="<?= url('devices/' . $d['id'] . '/unblock') ?>" class="d-inline"><?= $csrf->field() ?><button class="btn btn-sm btn-outline-success"><?= e(__('Unblock')) ?></button></form>
                                    <?php endif; ?>
                                <?php endif; ?>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                        <?php if ($devices === []): ?><tr><td colspan="6" class="empty-state"><?= e(__('No devices activated.')) ?></td></tr><?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="col-lg-4">
        <div class="card mb-4">
            <div class="card-body text-center">
                <div class="qr-box mb-3"><img src="<?= e($qr) ?>" alt="License QR" width="180" height="180"></div>
                <p class="small text-muted mb-0">Scan to reference the license key.</p>
            </div>
        </div>

        <?php if ($auth->can('licenses.manage')): ?>
        <div class="card">
            <div class="card-header"><h6 class="mb-0"><?= e(__('Actions')) ?></h6></div>
            <div class="card-body d-grid gap-2">
                <a href="<?= url('licenses/' . $license['id'] . '/download/lic') ?>" class="btn btn-primary">Download .lic File</a>
                <div class="btn-group">
                    <a href="<?= url('licenses/' . $license['id'] . '/download/key') ?>" class="btn btn-outline-primary btn-sm">.key</a>
                    <a href="<?= url('licenses/' . $license['id'] . '/download/dat') ?>" class="btn btn-outline-primary btn-sm">.dat</a>
                </div>
                <a href="<?= url('licenses/' . $license['id'] . '/print') ?>" target="_blank" class="btn btn-outline-secondary">Print Certificate</a>
                <a href="<?= url('licenses/' . $license['id'] . '/edit') ?>" class="btn btn-outline-secondary">Edit License</a>
                <form method="post" action="<?= url('licenses/' . $license['id'] . '/renew') ?>" data-confirm="Renew this license from today?"><?= $csrf->field() ?><button class="btn btn-outline-success w-100"><?= e(__('Renew')) ?></button></form>
                <?php if ($license['status'] !== 'revoked'): ?>
                <form method="post" action="<?= url('licenses/' . $license['id'] . '/revoke') ?>" data-confirm="Revoke this license? Clients will fail verification."><?= $csrf->field() ?><button class="btn btn-outline-warning w-100"><?= e(__('Revoke')) ?></button></form>
                <?php endif; ?>
                <form method="post" action="<?= url('licenses/' . $license['id'] . '/delete') ?>" data-confirm="Permanently delete this license?"><?= $csrf->field() ?><button class="btn btn-outline-danger w-100"><?= e(__('Delete')) ?></button></form>
            </div>
        </div>
        <?php endif; ?>

        <div class="card mt-4">
            <div class="card-header"><h6 class="mb-0"><?= e(__('Verification Endpoint')) ?></h6></div>
            <div class="card-body">
                <code class="small d-block text-break"><?= e($verifyUrl) ?></code>
                <span class="badge bg-success mt-2">RSA-4096 Signed</span>
                <span class="badge bg-info mt-2">AES-256 Encrypted</span>
            </div>
        </div>
    </div>
</div>
