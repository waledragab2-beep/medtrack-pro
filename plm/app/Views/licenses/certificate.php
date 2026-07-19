<?php
/**
 * Printable license certificate.
 *
 * @var array<string,mixed> $license
 * @var string $qr
 * @var string $company
 */
$modules = json_decode((string) ($license['modules'] ?? '[]'), true) ?: [];
?>
<div class="certificate">
    <div class="cert-header">
        <div class="cert-title"><?= e($company) ?></div>
        <div class="text-muted">Software License Certificate</div>
    </div>

    <div class="cert-key"><?= e($license['license_key']) ?></div>

    <div class="cert-grid">
        <div class="cert-field"><label><?= e(__('License Number')) ?></label><span><?= e($license['license_number']) ?></span></div>
        <div class="cert-field"><label><?= e(__('License Type')) ?></label><span><?= e(__(ucwords(str_replace('_', ' ', $license['type'])))) ?></span></div>
        <div class="cert-field"><label><?= e(__('Licensed To')) ?></label><span><?= e($license['customer_name']) ?></span></div>
        <div class="cert-field"><label><?= e(__('Product')) ?></label><span><?= e($license['product_name']) ?><?= $license['version_number'] ? ' v' . e($license['version_number']) : '' ?></span></div>
        <div class="cert-field"><label><?= e(__('Issue Date')) ?></label><span><?= human_date($license['issue_date']) ?></span></div>
        <div class="cert-field"><label><?= e(__('Expiry Date')) ?></label><span><?= $license['expire_date'] ? human_date($license['expire_date']) : 'Lifetime' ?></span></div>
        <div class="cert-field"><label><?= e(__('Users Allowed')) ?></label><span><?= (int) $license['users_limit'] ?></span></div>
        <div class="cert-field"><label><?= e(__('Devices Allowed')) ?></label><span><?= (int) $license['devices_limit'] ?></span></div>
    </div>

    <?php if ($modules): ?>
        <div class="cert-field"><label><?= e(__('Licensed Modules')) ?></label><span><?= e(implode(', ', $modules)) ?></span></div>
    <?php endif; ?>

    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:30px;">
        <div>
            <img src="<?= e($qr) ?>" alt="QR" width="120" height="120">
            <div style="font-size:11px;color:#888;">Scan to verify</div>
        </div>
        <div style="text-align:right;">
            <div style="border-top:1px solid #333; padding-top:6px; width:200px;">Authorized Signature</div>
            <div style="font-size:11px;color:#888;margin-top:8px;">Digitally signed · RSA-4096 / SHA-256</div>
            <div style="font-size:11px;color:#888;">Checksum: <?= e(substr((string) $license['checksum'], 0, 24)) ?>…</div>
        </div>
    </div>

    <div class="text-center mt-4">
        <button class="btn btn-primary" onclick="window.print()"><?= e(__('Print')) ?></button>
    </div>
</div>
