<?php
/**
 * Products listing.
 *
 * @var array{data:array,total:int,page:int,per_page:int,pages:int} $result
 * @var string $term
 * @var App\Core\Auth $auth
 */
?>
<div class="card">
    <div class="card-body">
        <div class="data-toolbar">
            <form class="d-flex gap-2" method="get" action="<?= url('products') ?>">
                <input type="search" name="q" class="form-control" placeholder="Search products…" value="<?= e($term) ?>">
                <button class="btn btn-primary">Search</button>
            </form>
            <div class="ms-auto">
                <?php if ($auth->can('products.manage')): ?>
                    <a href="<?= url('products/create') ?>" class="btn btn-primary">+ New Product</a>
                <?php endif; ?>
            </div>
        </div>
        <div class="table-responsive">
            <table class="table table-hover align-middle">
                <thead><tr><th>Name</th><th>Code</th><th>Category</th><th>Latest Version</th><th>Status</th><th class="text-end">Actions</th></tr></thead>
                <tbody>
                    <?php foreach ($result['data'] as $p): ?>
                    <tr>
                        <td><a href="<?= url('products/' . $p['id']) ?>" class="fw-semibold text-decoration-none"><?= e($p['name']) ?></a></td>
                        <td><span class="mono"><?= e($p['code']) ?></span></td>
                        <td><?= e($p['category'] ?: '—') ?></td>
                        <td><?= e($p['latest_version'] ?: '—') ?></td>
                        <td><span class="badge <?= status_badge($p['status']) ?>"><?= e(ucfirst($p['status'])) ?></span></td>
                        <td class="text-end">
                            <a href="<?= url('products/' . $p['id']) ?>" class="btn btn-sm btn-outline-secondary">View</a>
                            <?php if ($auth->can('products.manage')): ?>
                                <a href="<?= url('products/' . $p['id'] . '/edit') ?>" class="btn btn-sm btn-outline-primary">Edit</a>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                    <?php if ($result['data'] === []): ?><tr><td colspan="6" class="empty-state">No products found.</td></tr><?php endif; ?>
                </tbody>
            </table>
        </div>
        <?php include dirname(__DIR__) . '/partials/pagination.php'; ?>
    </div>
</div>
