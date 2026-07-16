<?php
/**
 * Version create/edit form.
 *
 * @var array<string,mixed>|null $version
 * @var array<int,array<string,mixed>> $products
 * @var App\Core\Csrf $csrf
 */
$v = $version ?? [];
$isEdit = !empty($v);
$action = $isEdit ? url('versions/' . $v['id'] . '/update') : url('versions');
?>
<div class="card">
    <div class="card-body">
        <form method="post" action="<?= e($action) ?>">
            <?= $csrf->field() ?>
            <div class="row g-3">
                <div class="col-md-6">
                    <label class="form-label"><?= e(__('Product')) ?> *</label>
                    <select class="form-select" name="product_id" required>
                        <option value="">— Select —</option>
                        <?php foreach ($products as $p): ?>
                            <option value="<?= (int) $p['id'] ?>" <?= (int) ($v['product_id'] ?? 0) === (int) $p['id'] ? 'selected' : '' ?>><?= e($p['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-md-3"><label class="form-label"><?= e(__('Version Number')) ?> *</label><input class="form-control" name="version_number" value="<?= e($v['version_number'] ?? '') ?>" required></div>
                <div class="col-md-3"><label class="form-label"><?= e(__('Build Number')) ?></label><input class="form-control" name="build_number" value="<?= e($v['build_number'] ?? '') ?>"></div>
                <div class="col-md-4"><label class="form-label"><?= e(__('Release Date')) ?></label><input type="date" class="form-control" name="release_date" value="<?= e($v['release_date'] ?? '') ?>"></div>
                <div class="col-md-4"><label class="form-label"><?= e(__('Min. Supported License')) ?></label><input class="form-control" name="min_supported_license" value="<?= e($v['min_supported_license'] ?? '') ?>"></div>
                <div class="col-md-4">
                    <label class="form-label"><?= e(__('Status')) ?></label>
                    <select class="form-select" name="status">
                        <?php foreach (['active', 'beta', 'deprecated'] as $s): ?>
                            <option value="<?= $s ?>" <?= ($v['status'] ?? 'active') === $s ? 'selected' : '' ?>><?= ucfirst($s) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-md-6"><label class="form-label"><?= e(__('Compatibility')) ?></label><input class="form-control" name="compatibility" value="<?= e($v['compatibility'] ?? '') ?>" placeholder="<?= e(__('e.g. Windows 10/11, Server 2019')) ?>"></div>
                <div class="col-md-6"><label class="form-label"><?= e(__('Download URL')) ?></label><input class="form-control" name="download_url" value="<?= e($v['download_url'] ?? '') ?>"></div>
                <div class="col-12"><label class="form-label"><?= e(__('Release Notes')) ?></label><textarea class="form-control" name="release_notes" rows="4"><?= e($v['release_notes'] ?? '') ?></textarea></div>
            </div>
            <div class="d-flex gap-2 mt-4">
                <button type="submit" class="btn btn-primary"><?= $isEdit ? 'Update' : 'Create' ?> Version</button>
                <a href="<?= url('versions') ?>" class="btn btn-outline-secondary"><?= e(__('Cancel')) ?></a>
            </div>
        </form>
    </div>
</div>
