<?php
/**
 * Roles listing.
 *
 * @var array<int,array<string,mixed>> $roles
 * @var App\Core\Auth $auth
 * @var App\Core\Csrf $csrf
 */
?>
<div class="card">
    <div class="card-body">
        <div class="data-toolbar">
            <div class="ms-auto">
                <?php if ($auth->can('roles.manage')): ?><a href="<?= url('roles/create') ?>" class="btn btn-primary">+ New Role</a><?php endif; ?>
            </div>
        </div>
        <div class="table-responsive">
            <table class="table table-hover align-middle">
                <thead><tr><th>Role</th><th>Description</th><th>Users</th><th>Permissions</th><th>Type</th><th class="text-end">Actions</th></tr></thead>
                <tbody>
                    <?php foreach ($roles as $r): ?>
                    <tr>
                        <td class="fw-semibold"><?= e($r['name']) ?></td>
                        <td class="text-muted small"><?= e($r['description'] ?: '—') ?></td>
                        <td><span class="badge bg-info"><?= (int) $r['user_count'] ?></span></td>
                        <td><span class="badge bg-secondary"><?= (int) $r['permission_count'] ?></span></td>
                        <td><?= (int) $r['is_system'] ? '<span class="badge bg-dark">System</span>' : '<span class="badge bg-light text-dark border">Custom</span>' ?></td>
                        <td class="text-end">
                            <?php if ($auth->can('roles.manage')): ?>
                                <a href="<?= url('roles/' . $r['id'] . '/edit') ?>" class="btn btn-sm btn-outline-primary">Edit</a>
                                <?php if (!(int) $r['is_system']): ?>
                                    <form method="post" action="<?= url('roles/' . $r['id'] . '/delete') ?>" class="d-inline" data-confirm="Delete this role?"><?= $csrf->field() ?><button class="btn btn-sm btn-outline-danger">Delete</button></form>
                                <?php endif; ?>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>
</div>
