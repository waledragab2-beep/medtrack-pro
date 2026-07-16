<?php
/**
 * Dashboard.
 *
 * @var array<string,mixed> $stats
 * @var array<int,array<string,mixed>> $expiring
 * @var array<int,array<string,mixed>> $recentLogs
 * @var array<int,array<string,mixed>> $latest
 */
$currency = config('general.currency', 'USD');
$cards = [
    ['label' => 'Active Customers', 'value' => (int) ($stats['active_customers'] ?? 0), 'icon' => 'people', 'class' => 'primary'],
    ['label' => 'Active Products',  'value' => (int) ($stats['active_products'] ?? 0),  'icon' => 'box',    'class' => 'info'],
    ['label' => 'Active Licenses',  'value' => (int) ($stats['active_licenses'] ?? 0),  'icon' => 'key',    'class' => 'success'],
    ['label' => 'Expired Licenses', 'value' => (int) ($stats['expired_licenses'] ?? 0), 'icon' => 'key',    'class' => 'danger'],
    ['label' => 'Expiring Soon',    'value' => (int) ($stats['expiring_soon'] ?? 0),    'icon' => 'bell',   'class' => 'warning'],
    ['label' => 'Active Devices',   'value' => (int) ($stats['active_devices'] ?? 0),   'icon' => 'cpu',    'class' => 'purple'],
];
?>
<div class="stat-grid">
    <?php foreach ($cards as $card): ?>
        <div class="stat-card stat-<?= $card['class'] ?>">
            <div class="stat-icon"><?= icon($card['icon']) ?></div>
            <div class="stat-body">
                <div class="stat-value" data-count="<?= $card['value'] ?>"><?= number_format($card['value']) ?></div>
                <div class="stat-label"><?= e(__($card['label'])) ?></div>
            </div>
        </div>
    <?php endforeach; ?>
    <div class="stat-card stat-revenue">
        <div class="stat-icon"><?= icon('chart') ?></div>
        <div class="stat-body">
            <div class="stat-value"><?= e($currency) ?> <?= number_format((float) ($stats['total_revenue'] ?? 0), 2) ?></div>
            <div class="stat-label"><?= e(__('Total Revenue')) ?></div>
        </div>
    </div>
</div>

<div class="row g-4 mt-1">
    <div class="col-lg-8">
        <div class="card h-100">
            <div class="card-header"><h5 class="mb-0"><?= e(__('Revenue (Last 12 Months)')) ?></h5></div>
            <div class="card-body"><canvas id="revenueChart" height="110"></canvas></div>
        </div>
    </div>
    <div class="col-lg-4">
        <div class="card h-100">
            <div class="card-header"><h5 class="mb-0"><?= e(__('Licenses by Type')) ?></h5></div>
            <div class="card-body"><canvas id="typeChart" height="180"></canvas></div>
        </div>
    </div>
</div>

<div class="row g-4 mt-1">
    <div class="col-lg-6">
        <div class="card h-100">
            <div class="card-header"><h5 class="mb-0"><?= e(__('Activations (Last 30 Days)')) ?></h5></div>
            <div class="card-body"><canvas id="activationChart" height="150"></canvas></div>
        </div>
    </div>
    <div class="col-lg-6">
        <div class="card h-100">
            <div class="card-header"><h5 class="mb-0"><?= e(__('License Status')) ?></h5></div>
            <div class="card-body"><canvas id="statusChart" height="150"></canvas></div>
        </div>
    </div>
</div>

<div class="row g-4 mt-1">
    <div class="col-lg-7">
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0"><?= e(__('Latest Licenses')) ?></h5>
                <a href="<?= url('licenses') ?>" class="btn btn-sm btn-outline-primary"><?= e(__('View all')) ?></a>
            </div>
            <div class="table-responsive">
                <table class="table table-hover mb-0 align-middle">
                    <thead><tr><th><?= e(__('Number')) ?></th><th><?= e(__('Customer')) ?></th><th><?= e(__('Product')) ?></th><th><?= e(__('Type')) ?></th><th><?= e(__('Status')) ?></th></tr></thead>
                    <tbody>
                        <?php foreach ($latest as $l): ?>
                        <tr>
                            <td><span class="mono"><?= e($l['license_number']) ?></span></td>
                            <td><?= e($l['company_name']) ?></td>
                            <td><?= e($l['product_name']) ?></td>
                            <td><span class="badge bg-light text-dark"><?= e(__(ucwords(str_replace('_', ' ', $l['type'])))) ?></span></td>
                            <td><span class="badge <?= status_badge($l['status']) ?>"><?= e(__(ucfirst($l['status']))) ?></span></td>
                        </tr>
                        <?php endforeach; ?>
                        <?php if ($latest === []): ?><tr><td colspan="5" class="text-center text-muted py-4"><?= e(__('No licenses yet.')) ?></td></tr><?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    <div class="col-lg-5">
        <div class="card">
            <div class="card-header"><h5 class="mb-0"><?= e(__('Expiring Soon')) ?></h5></div>
            <div class="list-group list-group-flush">
                <?php foreach (array_slice($expiring, 0, 6) as $ex): ?>
                    <div class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <div class="fw-semibold"><?= e($ex['company_name']) ?></div>
                            <small class="text-muted"><?= e($ex['license_number']) ?> · <?= e($ex['product_name']) ?></small>
                        </div>
                        <span class="badge <?= (int) $ex['days_remaining'] <= 7 ? 'bg-danger' : 'bg-warning text-dark' ?>">
                            <?= (int) $ex['days_remaining'] ?> <?= e(__('days')) ?>
                        </span>
                    </div>
                <?php endforeach; ?>
                <?php if ($expiring === []): ?><div class="list-group-item text-center text-muted py-4"><?= e(__('Nothing expiring soon.')) ?></div><?php endif; ?>
            </div>
        </div>
    </div>
</div>

<script>window.PLM_DASHBOARD = true;</script>
