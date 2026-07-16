<?php
/**
 * Product detail with versions and modules.
 *
 * @var array<string,mixed> $product
 * @var array<int,array<string,mixed>> $versions
 * @var array<int,array<string,mixed>> $modules
 * @var App\Core\Auth $auth
 * @var App\Core\Csrf $csrf
 */
?>
<div class="row g-4">
    <div class="col-lg-4">
        <div class="card">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <h5 class="mb-0"><?= e($product['name']) ?></h5>
                    <span class="badge <?= status_badge($product['status']) ?>"><?= e(ucfirst($product['status'])) ?></span>
                </div>
                <div class="detail-list">
                    <div class="detail-item"><label>Code</label><span class="mono"><?= e($product['code']) ?></span></div>
                    <div class="detail-item"><label>Category</label><span><?= e($product['category'] ?: '—') ?></span></div>
                    <div class="detail-item"><label>Latest Version</label><span><?= e($product['latest_version'] ?: '—') ?></span></div>
                </div>
                <?php if (!empty($product['description'])): ?><hr><p class="text-muted small mb-0"><?= nl2br(e($product['description'])) ?></p><?php endif; ?>
            </div>
            <?php if ($auth->can('products.manage')): ?>
            <div class="card-footer d-flex gap-2">
                <a href="<?= url('products/' . $product['id'] . '/edit') ?>" class="btn btn-sm btn-primary">Edit</a>
                <form method="post" action="<?= url('products/' . $product['id'] . '/delete') ?>" data-confirm="Delete this product?">
                    <?= $csrf->field() ?><button class="btn btn-sm btn-outline-danger">Delete</button>
                </form>
            </div>
            <?php endif; ?>
        </div>
    </div>
    <div class="col-lg-8">
        <div class="card mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Versions (<?= count($versions) ?>)</h5>
                <?php if ($auth->can('products.manage')): ?><a href="<?= url('versions/create') ?>" class="btn btn-sm btn-primary">+ Version</a><?php endif; ?>
            </div>
            <div class="table-responsive">
                <table class="table table-hover mb-0 align-middle">
                    <thead><tr><th>Version</th><th>Build</th><th>Released</th><th>Status</th></tr></thead>
                    <tbody>
                        <?php foreach ($versions as $v): ?>
                        <tr><td class="fw-semibold"><?= e($v['version_number']) ?></td><td><?= e($v['build_number'] ?: '—') ?></td>
                        <td><?= human_date($v['release_date']) ?></td><td><span class="badge <?= status_badge($v['status']) ?>"><?= e(ucfirst($v['status'])) ?></span></td></tr>
                        <?php endforeach; ?>
                        <?php if ($versions === []): ?><tr><td colspan="4" class="empty-state">No versions yet.</td></tr><?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
        <div class="card">
            <div class="card-header"><h5 class="mb-0">Feature Modules (<?= count($modules) ?>)</h5></div>
            <div class="card-body">
                <?php foreach ($modules as $m): ?>
                    <span class="badge bg-light text-dark border me-1 mb-1" title="<?= e($m['description'] ?? '') ?>"><?= e($m['name']) ?> · <span class="mono"><?= e($m['code']) ?></span></span>
                <?php endforeach; ?>
                <?php if ($modules === []): ?><p class="text-muted mb-0">No modules defined.</p><?php endif; ?>
            </div>
        </div>
    </div>
</div>
