<?php
/**
 * Role create/edit form with permission matrix.
 *
 * @var array<string,mixed>|null $role
 * @var array<string,array<int,array<string,mixed>>> $permissions
 * @var int[] $assigned
 * @var App\Core\Csrf $csrf
 */
$r = $role ?? [];
$isEdit = !empty($r);
$action = $isEdit ? url('roles/' . $r['id'] . '/update') : url('roles');
$isSuper = ($r['slug'] ?? '') === 'super-admin';
?>
<div class="card">
    <div class="card-body">
        <form method="post" action="<?= e($action) ?>">
            <?= $csrf->field() ?>
            <div class="row g-3 mb-4">
                <div class="col-md-4"><label class="form-label">Role Name *</label><input class="form-control" name="name" value="<?= e($r['name'] ?? '') ?>" required></div>
                <div class="col-md-8"><label class="form-label">Description</label><input class="form-control" name="description" value="<?= e($r['description'] ?? '') ?>"></div>
            </div>

            <div class="form-section-title">Permissions</div>
            <?php if ($isSuper): ?>
                <div class="alert alert-info">The Super Administrator role always has all permissions and cannot be restricted.</div>
            <?php else: ?>
            <div class="row g-3">
                <?php foreach ($permissions as $module => $perms): ?>
                    <div class="col-md-4">
                        <div class="card h-100">
                            <div class="card-body">
                                <h6 class="text-capitalize mb-3"><?= e($module) ?></h6>
                                <?php foreach ($perms as $p): ?>
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" name="permissions[]" value="<?= (int) $p['id'] ?>" id="perm<?= (int) $p['id'] ?>" <?= in_array((int) $p['id'], $assigned, true) ? 'checked' : '' ?>>
                                        <label class="form-check-label small" for="perm<?= (int) $p['id'] ?>"><?= e($p['name']) ?></label>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>

            <div class="d-flex gap-2 mt-4">
                <button type="submit" class="btn btn-primary"><?= $isEdit ? 'Update' : 'Create' ?> Role</button>
                <a href="<?= url('roles') ?>" class="btn btn-outline-secondary">Cancel</a>
            </div>
        </form>
    </div>
</div>
