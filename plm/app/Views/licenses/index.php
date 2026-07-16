<?php
/**
 * Licenses listing with filters.
 *
 * @var array{data:array,total:int,page:int,per_page:int,pages:int} $result
 * @var array<string,string> $filters
 * @var array<int,array<string,mixed>> $customers
 * @var array<int,array<string,mixed>> $products
 * @var App\Core\Auth $auth
 */
$types = ['all' => 'All Types', 'trial' => 'Trial', 'monthly' => 'Monthly', 'quarterly' => 'Quarterly', 'semi_annual' => 'Semi Annual', 'yearly' => 'Yearly', 'lifetime' => 'Lifetime', 'developer' => 'Developer', 'enterprise' => 'Enterprise'];
$statuses = ['all' => 'All Statuses', 'active' => 'Active', 'expired' => 'Expired', 'suspended' => 'Suspended', 'revoked' => 'Revoked', 'pending' => 'Pending'];
?>
<div class="card">
    <div class="card-body">
        <form class="data-toolbar" method="get" action="<?= url('licenses') ?>">
            <input type="search" name="q" class="form-control" placeholder="Search number / key / customer…" value="<?= e($filters['term']) ?>">
            <select name="status" class="form-select">
                <?php foreach ($statuses as $k => $v): ?><option value="<?= $k ?>" <?= $filters['status'] === $k ? 'selected' : '' ?>><?= e($v) ?></option><?php endforeach; ?>
            </select>
            <select name="type" class="form-select">
                <?php foreach ($types as $k => $v): ?><option value="<?= $k ?>" <?= $filters['type'] === $k ? 'selected' : '' ?>><?= e($v) ?></option><?php endforeach; ?>
            </select>
            <button class="btn btn-primary">Filter</button>
            <div class="ms-auto">
                <?php if ($auth->can('licenses.manage')): ?><a href="<?= url('licenses/create') ?>" class="btn btn-primary">+ Generate License</a><?php endif; ?>
            </div>
        </form>
        <div class="table-responsive">
            <table class="table table-hover align-middle">
                <thead><tr><th>Number</th><th>Customer</th><th>Product</th><th>Type</th><th>Issued</th><th>Expiry</th><th>Status</th><th class="text-end">Actions</th></tr></thead>
                <tbody>
                    <?php foreach ($result['data'] as $l): ?>
                    <tr>
                        <td><a href="<?= url('licenses/' . $l['id']) ?>" class="mono text-decoration-none fw-semibold"><?= e($l['license_number']) ?></a></td>
                        <td><?= e($l['customer_name']) ?></td>
                        <td><?= e($l['product_name']) ?></td>
                        <td><span class="badge bg-light text-dark border"><?= e(ucfirst(str_replace('_', ' ', $l['type']))) ?></span></td>
                        <td><?= human_date($l['issue_date']) ?></td>
                        <td><?= $l['expire_date'] ? human_date($l['expire_date']) : '<span class="text-muted">Lifetime</span>' ?></td>
                        <td><span class="badge <?= status_badge($l['status']) ?>"><?= e(ucfirst($l['status'])) ?></span></td>
                        <td class="text-end">
                            <a href="<?= url('licenses/' . $l['id']) ?>" class="btn btn-sm btn-outline-secondary">View</a>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                    <?php if ($result['data'] === []): ?><tr><td colspan="8" class="empty-state">No licenses found.</td></tr><?php endif; ?>
                </tbody>
            </table>
        </div>
        <?php include dirname(__DIR__) . '/partials/pagination.php'; ?>
    </div>
</div>
