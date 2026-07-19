<?php
/**
 * User create/edit form.
 *
 * @var array<string,mixed>|null $user
 * @var array<int,array<string,mixed>> $roles
 * @var App\Core\Csrf $csrf
 */
$u = $user ?? [];
$isEdit = !empty($u);
$action = $isEdit ? url('users/' . $u['id'] . '/update') : url('users');
?>
<div class="card">
    <div class="card-body">
        <form method="post" action="<?= e($action) ?>" autocomplete="off">
            <?= $csrf->field() ?>
            <div class="row g-3">
                <div class="col-md-6"><label class="form-label"><?= e(__('Full Name')) ?> *</label><input class="form-control" name="name" value="<?= e($u['name'] ?? '') ?>" required></div>
                <div class="col-md-6"><label class="form-label"><?= e(__('Username')) ?> *</label><input class="form-control mono" name="username" value="<?= e($u['username'] ?? '') ?>" required></div>
                <div class="col-md-6"><label class="form-label"><?= e(__('Email')) ?> *</label><input type="email" class="form-control" name="email" value="<?= e($u['email'] ?? '') ?>" required></div>
                <div class="col-md-6"><label class="form-label"><?= e(__('Phone')) ?></label><input class="form-control" name="phone" value="<?= e($u['phone'] ?? '') ?>"></div>
                <div class="col-md-6">
                    <label class="form-label">Password <?= $isEdit ? '(leave blank to keep)' : '*' ?></label>
                    <input type="password" class="form-control" name="password" <?= $isEdit ? '' : 'required minlength="8"' ?>>
                </div>
                <div class="col-md-6">
                    <label class="form-label"><?= e(__('Role')) ?> *</label>
                    <select class="form-select" name="role_id" required>
                        <?php foreach ($roles as $r): ?>
                            <option value="<?= (int) $r['id'] ?>" <?= (int) ($u['role_id'] ?? 0) === (int) $r['id'] ? 'selected' : '' ?>><?= e($r['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-12">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" name="is_active" value="1" id="isActive" <?= (int) ($u['is_active'] ?? 1) ? 'checked' : '' ?>>
                        <label class="form-check-label" for="isActive">Account active</label>
                    </div>
                </div>
            </div>
            <div class="d-flex gap-2 mt-4">
                <button type="submit" class="btn btn-primary"><?= $isEdit ? 'Update' : 'Create' ?> User</button>
                <a href="<?= url('users') ?>" class="btn btn-outline-secondary"><?= e(__('Cancel')) ?></a>
            </div>
        </form>
    </div>
</div>
