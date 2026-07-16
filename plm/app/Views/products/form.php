<?php
/**
 * Product create/edit form.
 *
 * @var array<string,mixed>|null $product
 * @var App\Core\Csrf $csrf
 */
$p = $product ?? [];
$isEdit = !empty($p);
$action = $isEdit ? url('products/' . $p['id'] . '/update') : url('products');
?>
<div class="card">
    <div class="card-body">
        <form method="post" action="<?= e($action) ?>">
            <?= $csrf->field() ?>
            <div class="row g-3">
                <div class="col-md-8"><label class="form-label">Product Name *</label><input class="form-control" name="name" value="<?= e($p['name'] ?? '') ?>" required></div>
                <div class="col-md-4"><label class="form-label">Product Code *</label><input class="form-control mono" name="code" value="<?= e($p['code'] ?? '') ?>" required></div>
                <div class="col-md-6"><label class="form-label">Category</label><input class="form-control" name="category" value="<?= e($p['category'] ?? '') ?>"></div>
                <div class="col-md-6"><label class="form-label">Latest Version</label><input class="form-control" name="latest_version" value="<?= e($p['latest_version'] ?? '') ?>"></div>
                <div class="col-12"><label class="form-label">Description</label><textarea class="form-control" name="description" rows="4"><?= e($p['description'] ?? '') ?></textarea></div>
                <div class="col-md-4">
                    <label class="form-label">Status</label>
                    <select class="form-select" name="status">
                        <option value="active" <?= ($p['status'] ?? 'active') === 'active' ? 'selected' : '' ?>>Active</option>
                        <option value="inactive" <?= ($p['status'] ?? '') === 'inactive' ? 'selected' : '' ?>>Inactive</option>
                    </select>
                </div>
            </div>
            <div class="d-flex gap-2 mt-4">
                <button type="submit" class="btn btn-primary"><?= $isEdit ? 'Update' : 'Create' ?> Product</button>
                <a href="<?= url('products') ?>" class="btn btn-outline-secondary">Cancel</a>
            </div>
        </form>
    </div>
</div>
