<?php
/**
 * License generation / edit form.
 *
 * @var array<string,mixed>|null $license
 * @var array<int,array<string,mixed>> $customers
 * @var array<int,array<string,mixed>> $products
 * @var array<int,array<string,mixed>> $versions
 * @var array<int,array<string,mixed>> $modules
 * @var array<string,int|null> $types
 * @var App\Core\Csrf $csrf
 */
$l = $license ?? [];
$isEdit = !empty($l);
$action = $isEdit ? url('licenses/' . $l['id'] . '/update') : url('licenses');
$selectedModules = [];
if (!empty($l['modules'])) {
    $decoded = is_string($l['modules']) ? json_decode($l['modules'], true) : $l['modules'];
    $selectedModules = is_array($decoded) ? $decoded : [];
}
?>
<div class="card">
    <div class="card-body">
        <form method="post" action="<?= e($action) ?>">
            <?= $csrf->field() ?>

            <div class="form-section">
                <div class="form-section-title">License Assignment</div>
                <div class="row g-3">
                    <div class="col-md-6">
                        <label class="form-label">Customer *</label>
                        <select class="form-select" name="customer_id" required>
                            <option value="">— Select customer —</option>
                            <?php foreach ($customers as $c): ?>
                                <option value="<?= (int) $c['id'] ?>" <?= (int) ($l['customer_id'] ?? 0) === (int) $c['id'] ? 'selected' : '' ?>><?= e($c['company_name']) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Product *</label>
                        <select class="form-select" name="product_id" required>
                            <option value="">— Select —</option>
                            <?php foreach ($products as $p): ?>
                                <option value="<?= (int) $p['id'] ?>" <?= (int) ($l['product_id'] ?? 0) === (int) $p['id'] ? 'selected' : '' ?>><?= e($p['name']) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Version</label>
                        <select class="form-select" name="version_id">
                            <option value="">— Any —</option>
                            <?php foreach ($versions as $v): ?>
                                <option value="<?= (int) $v['id'] ?>" <?= (int) ($l['version_id'] ?? 0) === (int) $v['id'] ? 'selected' : '' ?>><?= e($v['product_code'] . ' ' . $v['version_number']) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                </div>
            </div>

            <div class="form-section">
                <div class="form-section-title">License Terms</div>
                <div class="row g-3">
                    <div class="col-md-4">
                        <label class="form-label">License Type *</label>
                        <select class="form-select" name="type" id="licenseType" required>
                            <?php foreach ($types as $t => $days): ?>
                                <option value="<?= $t ?>" <?= ($l['type'] ?? 'trial') === $t ? 'selected' : '' ?>><?= ucwords(str_replace('_', ' ', $t)) ?><?= $days ? " ({$days}d)" : ' (perpetual)' ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="col-md-4"><label class="form-label">Issue Date *</label><input type="date" class="form-control" id="issueDate" name="issue_date" value="<?= e($l['issue_date'] ?? date('Y-m-d')) ?>" required></div>
                    <div class="col-md-4"><label class="form-label">Expiry Date</label><input type="date" class="form-control" id="expireDate" name="expire_date" value="<?= e($l['expire_date'] ?? '') ?>"><small class="text-muted">Auto-computed from type; override if needed.</small></div>
                    <div class="col-md-3"><label class="form-label">Users Limit *</label><input type="number" min="1" class="form-control" name="users_limit" value="<?= e($l['users_limit'] ?? 1) ?>" required></div>
                    <div class="col-md-3"><label class="form-label">Devices Limit *</label><input type="number" min="1" class="form-control" name="devices_limit" value="<?= e($l['devices_limit'] ?? 1) ?>" required></div>
                    <div class="col-md-3"><label class="form-label">Branches Limit *</label><input type="number" min="1" class="form-control" name="branches_limit" value="<?= e($l['branches_limit'] ?? 1) ?>" required></div>
                    <?php if ($isEdit): ?>
                    <div class="col-md-3">
                        <label class="form-label">Status</label>
                        <select class="form-select" name="status">
                            <?php foreach (['active', 'expired', 'suspended', 'revoked', 'pending'] as $s): ?>
                                <option value="<?= $s ?>" <?= ($l['status'] ?? 'active') === $s ? 'selected' : '' ?>><?= ucfirst($s) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <?php endif; ?>
                </div>
            </div>

            <div class="form-section">
                <div class="form-section-title">Licensed Modules</div>
                <div class="row g-2">
                    <?php foreach ($modules as $m): ?>
                        <div class="col-md-3 col-6">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="modules[]" value="<?= e($m['code']) ?>" id="mod<?= (int) $m['id'] ?>" <?= in_array($m['code'], $selectedModules, true) ? 'checked' : '' ?>>
                                <label class="form-check-label" for="mod<?= (int) $m['id'] ?>"><?= e($m['name']) ?></label>
                            </div>
                        </div>
                    <?php endforeach; ?>
                    <?php if ($modules === []): ?><p class="text-muted mb-0">No feature modules defined yet.</p><?php endif; ?>
                </div>
            </div>

            <div class="form-section">
                <div class="form-section-title">Commercial</div>
                <div class="row g-3">
                    <div class="col-md-3"><label class="form-label">Price</label><input type="number" step="0.01" min="0" class="form-control" name="price" value="<?= e($l['price'] ?? '0.00') ?>"></div>
                    <div class="col-md-3">
                        <label class="form-label">Currency</label>
                        <select class="form-select" name="currency">
                            <?php foreach (['USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP'] as $cur): ?>
                                <option value="<?= $cur ?>" <?= ($l['currency'] ?? config('general.currency', 'USD')) === $cur ? 'selected' : '' ?>><?= $cur ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="col-12"><label class="form-label">Notes</label><textarea class="form-control" name="notes" rows="2"><?= e($l['notes'] ?? '') ?></textarea></div>
                </div>
            </div>

            <div class="d-flex gap-2">
                <button type="submit" class="btn btn-primary"><?= $isEdit ? 'Update License' : 'Generate License' ?></button>
                <a href="<?= url('licenses') ?>" class="btn btn-outline-secondary">Cancel</a>
            </div>
        </form>
    </div>
</div>
