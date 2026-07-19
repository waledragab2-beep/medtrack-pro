<?php
/**
 * Settings page with grouped tabs.
 *
 * @var array<string,array<int,array<string,mixed>>> $grouped
 * @var array<string,mixed> $settings
 * @var bool $keysExist
 * @var App\Core\Auth $auth
 * @var App\Core\Csrf $csrf
 */
$labels = [
    'company_name' => 'Company Name', 'company_email' => 'Company Email', 'company_phone' => 'Company Phone',
    'company_address' => 'Address', 'company_website' => 'Website', 'vat_number' => 'VAT Number',
    'default_locale' => 'Default Language', 'default_theme' => 'Default Theme', 'timezone' => 'Timezone',
    'currency' => 'Currency', 'items_per_page' => 'Items Per Page', 'expiring_window' => 'Expiring Window (days)',
    'smtp_host' => 'SMTP Host', 'smtp_port' => 'SMTP Port', 'smtp_user' => 'SMTP Username',
    'smtp_password' => 'SMTP Password', 'smtp_encryption' => 'Encryption', 'smtp_from_email' => 'From Email',
    'smtp_from_name' => 'From Name', 'license_prefix' => 'License Prefix', 'default_grace' => 'Grace Period (days)',
];
?>
<form method="post" action="<?= url('settings') ?>" enctype="multipart/form-data">
    <?= $csrf->field() ?>
    <ul class="nav nav-tabs mb-4" role="tablist">
        <?php $first = true; foreach (array_keys($grouped) as $group): ?>
            <li class="nav-item"><button class="nav-link <?= $first ? 'active' : '' ?>" data-bs-toggle="tab" data-bs-target="#tab-<?= e($group) ?>" type="button"><?= e(ucfirst($group)) ?></button></li>
        <?php $first = false; endforeach; ?>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-security" type="button">Security</button></li>
    </ul>

    <div class="tab-content">
        <?php $first = true; foreach ($grouped as $group => $items): ?>
            <div class="tab-pane fade <?= $first ? 'show active' : '' ?>" id="tab-<?= e($group) ?>">
                <div class="card"><div class="card-body"><div class="row g-3">
                    <?php foreach ($items as $item): $key = $item['key_name']; $val = $settings[$key] ?? $item['value']; ?>
                        <div class="col-md-6">
                            <label class="form-label"><?= e($labels[$key] ?? ucwords(str_replace('_', ' ', $key))) ?></label>
                            <?php if ($key === 'default_theme'): ?>
                                <select class="form-select" name="<?= e($key) ?>"><option value="light" <?= $val === 'light' ? 'selected' : '' ?>><?= e(__('Light')) ?></option><option value="dark" <?= $val === 'dark' ? 'selected' : '' ?>><?= e(__('Dark')) ?></option></select>
                            <?php elseif ($key === 'default_locale'): ?>
                                <select class="form-select" name="<?= e($key) ?>"><option value="en" <?= $val === 'en' ? 'selected' : '' ?>>English</option><option value="ar" <?= $val === 'ar' ? 'selected' : '' ?>>العربية</option></select>
                            <?php elseif ($key === 'smtp_encryption'): ?>
                                <select class="form-select" name="<?= e($key) ?>"><option value="tls" <?= $val === 'tls' ? 'selected' : '' ?>>TLS</option><option value="ssl" <?= $val === 'ssl' ? 'selected' : '' ?>>SSL</option><option value="none" <?= $val === 'none' ? 'selected' : '' ?>><?= e(__('None')) ?></option></select>
                            <?php elseif ($key === 'smtp_password'): ?>
                                <input type="password" class="form-control" name="<?= e($key) ?>" value="<?= e($val) ?>" autocomplete="new-password">
                            <?php else: ?>
                                <input class="form-control" name="<?= e($key) ?>" value="<?= e($val) ?>">
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                    <?php if ($group === 'company'): ?>
                        <div class="col-md-6"><label class="form-label"><?= e(__('Company Logo')) ?></label><input type="file" class="form-control" name="company_logo" accept="image/*"><?php if (!empty($settings['company_logo'])): ?><img src="<?= asset('../' . $settings['company_logo']) ?>" alt="logo" height="40" class="mt-2"><?php endif; ?></div>
                    <?php endif; ?>
                    <?php if ($group === 'smtp'): ?>
                        <div class="col-12"><hr>
                            <div class="input-group" style="max-width:460px">
                                <input type="email" class="form-control" id="testMailInput" placeholder="<?= e(__('Send test email to…')) ?>">
                                <button class="btn btn-outline-secondary" type="button" id="testMailBtn"><?= e(__('Send Test')) ?></button>
                            </div>
                            <div id="testMailResult"></div>
                        </div>
                    <?php endif; ?>
                </div></div></div>
            </div>
        <?php $first = false; endforeach; ?>

        <div class="tab-pane fade" id="tab-security">
            <div class="card"><div class="card-body">
                <h6>Encryption Keys</h6>
                <p class="text-muted small">RSA-4096 key pair used to sign and verify license files.</p>
                <p>Status: <?= $keysExist ? '<span class="badge bg-success">Keys present</span>' : '<span class="badge bg-danger">Missing</span>' ?></p>
                <?php if ($auth->isSuperAdmin()): ?>
                    <button type="button" class="btn btn-outline-danger" onclick="if(confirm('Regenerating keys invalidates all existing license files. Continue?')){document.getElementById('regenKeysForm').submit();}"><?= e(__('Regenerate Keys')) ?></button>
                <?php else: ?>
                    <p class="text-muted small">Only a super administrator may regenerate keys.</p>
                <?php endif; ?>
            </div></div>
        </div>
    </div>

    <div class="mt-4"><button type="submit" class="btn btn-primary"><?= e(__('Save Settings')) ?></button></div>
</form>

<?php if ($auth->isSuperAdmin()): ?>
<form id="regenKeysForm" method="post" action="<?= url('settings/regenerate-keys') ?>" class="d-none"><?= $csrf->field() ?></form>
<?php endif; ?>
