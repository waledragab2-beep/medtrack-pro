<?php
/**
 * Users listing.
 *
 * @var array<int,array<string,mixed>> $users
 * @var App\Core\Auth $auth
 * @var App\Core\Csrf $csrf
 */
?>
<div class="card">
    <div class="card-body">
        <div class="data-toolbar">
            <div class="ms-auto">
                <?php if ($auth->can('users.manage')): ?><a href="<?= url('users/create') ?>" class="btn btn-primary"><?= e(__('+ New User')) ?></a><?php endif; ?>
            </div>
        </div>
        <div class="table-responsive">
            <table class="table table-hover align-middle" data-datatable>
                <thead><tr><th><?= e(__('Name')) ?></th><th><?= e(__('Username')) ?></th><th><?= e(__('Email')) ?></th><th><?= e(__('Role')) ?></th><th><?= e(__('Last Login')) ?></th><th><?= e(__('Status')) ?></th><th class="text-end"><?= e(__('Actions')) ?></th></tr></thead>
                <tbody>
                    <?php foreach ($users as $u): ?>
                    <tr>
                        <td class="fw-semibold"><?= e($u['name']) ?></td>
                        <td><span class="mono"><?= e($u['username']) ?></span></td>
                        <td><?= e($u['email']) ?></td>
                        <td><span class="badge bg-light text-dark border"><?= e($u['role_name']) ?></span></td>
                        <td><?= $u['last_login_at'] ? human_date($u['last_login_at'], 'Y-m-d H:i') : '<span class="text-muted">Never</span>' ?></td>
                        <td><span class="badge <?= (int) $u['is_active'] ? 'bg-success' : 'bg-secondary' ?>"><?= (int) $u['is_active'] ? 'Active' : 'Inactive' ?></span></td>
                        <td class="text-end">
                            <?php if ($auth->can('users.manage')): ?>
                                <a href="<?= url('users/' . $u['id'] . '/edit') ?>" class="btn btn-sm btn-outline-primary"><?= e(__('Edit')) ?></a>
                                <?php if ((int) $u['id'] !== (int) $auth->id()): ?>
                                    <form method="post" action="<?= url('users/' . $u['id'] . '/delete') ?>" class="d-inline" data-confirm="Delete this user?"><?= $csrf->field() ?><button class="btn btn-sm btn-outline-danger"><?= e(__('Delete')) ?></button></form>
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
