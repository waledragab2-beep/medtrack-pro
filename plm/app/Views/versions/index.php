<?php
/**
 * Software versions listing.
 *
 * @var array<int,array<string,mixed>> $versions
 * @var App\Core\Auth $auth
 * @var App\Core\Csrf $csrf
 */
?>
<div class="card">
    <div class="card-body">
        <div class="data-toolbar">
            <div class="ms-auto">
                <?php if ($auth->can('products.manage')): ?><a href="<?= url('versions/create') ?>" class="btn btn-primary"><?= e(__('+ New Version')) ?></a><?php endif; ?>
            </div>
        </div>
        <div class="table-responsive">
            <table class="table table-hover align-middle" data-datatable>
                <thead><tr><th><?= e(__('Product')) ?></th><th><?= e(__('Version')) ?></th><th><?= e(__('Build')) ?></th><th><?= e(__('Release Date')) ?></th><th><?= e(__('Status')) ?></th><th class="text-end"><?= e(__('Actions')) ?></th></tr></thead>
                <tbody>
                    <?php foreach ($versions as $v): ?>
                    <tr>
                        <td><?= e($v['product_name']) ?> <span class="mono text-muted">(<?= e($v['product_code']) ?>)</span></td>
                        <td class="fw-semibold"><?= e($v['version_number']) ?></td>
                        <td><?= e($v['build_number'] ?: '—') ?></td>
                        <td><?= human_date($v['release_date']) ?></td>
                        <td><span class="badge <?= status_badge($v['status']) ?>"><?= e(__(ucfirst($v['status']))) ?></span></td>
                        <td class="text-end">
                            <?php if ($auth->can('products.manage')): ?>
                                <a href="<?= url('versions/' . $v['id'] . '/edit') ?>" class="btn btn-sm btn-outline-primary"><?= e(__('Edit')) ?></a>
                                <form method="post" action="<?= url('versions/' . $v['id'] . '/delete') ?>" class="d-inline" data-confirm="Delete this version?">
                                    <?= $csrf->field() ?><button class="btn btn-sm btn-outline-danger"><?= e(__('Delete')) ?></button>
                                </form>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                    <?php if ($versions === []): ?><tr><td colspan="6" class="empty-state"><?= e(__('No versions yet.')) ?></td></tr><?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>
</div>
