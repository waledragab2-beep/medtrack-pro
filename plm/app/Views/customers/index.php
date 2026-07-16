<?php
/**
 * Customers listing.
 *
 * @var array{data:array,total:int,page:int,per_page:int,pages:int} $result
 * @var string $term
 * @var string $status
 * @var App\Core\Auth $auth
 */
?>
<div class="card">
    <div class="card-body">
        <div class="data-toolbar">
            <form class="d-flex gap-2 flex-wrap" method="get" action="<?= url('customers') ?>">
                <input type="search" name="q" class="form-control" placeholder="<?= e(__('Search customers…')) ?>" value="<?= e($term) ?>">
                <select name="status" class="form-select">
                    <?php foreach (['all' => 'All Statuses', 'active' => 'Active', 'inactive' => 'Inactive', 'suspended' => 'Suspended'] as $k => $v): ?>
                        <option value="<?= $k ?>" <?= $status === $k ? 'selected' : '' ?>><?= e(__($v)) ?></option>
                    <?php endforeach; ?>
                </select>
                <button class="btn btn-primary"><?= e(__('Filter')) ?></button>
            </form>
            <div class="ms-auto">
                <?php if ($auth->can('customers.manage')): ?>
                    <a href="<?= url('customers/create') ?>" class="btn btn-primary"><?= e(__('+ New Customer')) ?></a>
                <?php endif; ?>
            </div>
        </div>

        <div class="table-responsive">
            <table class="table table-hover align-middle">
                <thead>
                    <tr><th><?= e(__('Company')) ?></th><th><?= e(__('Contact')) ?></th><th><?= e(__('Email')) ?></th><th><?= e(__('Country')) ?></th><th><?= e(__('Status')) ?></th><th class="text-end"><?= e(__('Actions')) ?></th></tr>
                </thead>
                <tbody>
                    <?php foreach ($result['data'] as $c): ?>
                    <tr>
                        <td><a href="<?= url('customers/' . $c['id']) ?>" class="fw-semibold text-decoration-none"><?= e($c['company_name']) ?></a></td>
                        <td><?= e($c['contact_person'] ?: '—') ?></td>
                        <td><?= e($c['email'] ?: '—') ?></td>
                        <td><?= e($c['country'] ?: '—') ?></td>
                        <td><span class="badge <?= status_badge($c['status']) ?>"><?= e(__(ucfirst($c['status']))) ?></span></td>
                        <td class="text-end">
                            <a href="<?= url('customers/' . $c['id']) ?>" class="btn btn-sm btn-outline-secondary"><?= e(__('View')) ?></a>
                            <?php if ($auth->can('customers.manage')): ?>
                                <a href="<?= url('customers/' . $c['id'] . '/edit') ?>" class="btn btn-sm btn-outline-primary"><?= e(__('Edit')) ?></a>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                    <?php if ($result['data'] === []): ?>
                        <tr><td colspan="6" class="empty-state"><?= e(__('No customers found.')) ?></td></tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>

        <?php include dirname(__DIR__) . '/partials/pagination.php'; ?>
    </div>
</div>
