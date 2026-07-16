<?php
/**
 * Audit log viewer.
 *
 * @var array{data:array,total:int,page:int,per_page:int,pages:int} $result
 * @var string $term
 * @var string $action
 * @var string[] $actions
 */
?>
<div class="card">
    <div class="card-body">
        <form class="data-toolbar" method="get" action="<?= url('audit') ?>">
            <input type="search" name="q" class="form-control" placeholder="Search description / entity…" value="<?= e($term) ?>">
            <select name="action" class="form-select">
                <option value="all">All Actions</option>
                <?php foreach ($actions as $a): ?><option value="<?= e($a) ?>" <?= $action === $a ? 'selected' : '' ?>><?= e(ucfirst($a)) ?></option><?php endforeach; ?>
            </select>
            <button class="btn btn-primary">Filter</button>
        </form>
        <div class="table-responsive">
            <table class="table table-hover align-middle">
                <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Description</th><th>IP</th></tr></thead>
                <tbody>
                    <?php foreach ($result['data'] as $a): ?>
                    <tr>
                        <td class="text-nowrap small"><?= human_date($a['created_at'], 'Y-m-d H:i:s') ?></td>
                        <td><?= e($a['user_name'] ?: 'System') ?></td>
                        <td><span class="badge bg-light text-dark border"><?= e($a['action']) ?></span></td>
                        <td><?= e($a['entity'] ?: '—') ?><?= $a['entity_id'] ? ' #' . (int) $a['entity_id'] : '' ?></td>
                        <td class="small"><?= e($a['description']) ?></td>
                        <td><span class="mono small"><?= e($a['ip_address']) ?></span></td>
                    </tr>
                    <?php endforeach; ?>
                    <?php if ($result['data'] === []): ?><tr><td colspan="6" class="empty-state">No audit entries found.</td></tr><?php endif; ?>
                </tbody>
            </table>
        </div>
        <?php include dirname(__DIR__) . '/partials/pagination.php'; ?>
    </div>
</div>
