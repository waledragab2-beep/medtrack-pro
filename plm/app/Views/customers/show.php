<?php
/**
 * Customer detail.
 *
 * @var array<string,mixed> $customer
 * @var array<int,array<string,mixed>> $licenses
 * @var App\Core\Auth $auth
 * @var App\Core\Csrf $csrf
 */
?>
<div class="row g-4">
    <div class="col-lg-4">
        <div class="card">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <h5 class="mb-0"><?= e($customer['company_name']) ?></h5>
                    <span class="badge <?= status_badge($customer['status']) ?>"><?= e(__(ucfirst($customer['status']))) ?></span>
                </div>
                <div class="detail-list">
                    <div class="detail-item"><label><?= e(__('Contact')) ?></label><span><?= e($customer['contact_person'] ?: '—') ?></span></div>
                    <div class="detail-item"><label><?= e(__('Email')) ?></label><span><?= e($customer['email'] ?: '—') ?></span></div>
                    <div class="detail-item"><label><?= e(__('Phone')) ?></label><span><?= e($customer['phone'] ?: '—') ?></span></div>
                    <div class="detail-item"><label><?= e(__('Mobile')) ?></label><span><?= e($customer['mobile'] ?: '—') ?></span></div>
                    <div class="detail-item"><label><?= e(__('Country')) ?></label><span><?= e($customer['country'] ?: '—') ?></span></div>
                    <div class="detail-item"><label><?= e(__('City')) ?></label><span><?= e($customer['city'] ?: '—') ?></span></div>
                    <div class="detail-item"><label><?= e(__('VAT')) ?></label><span><?= e($customer['vat_number'] ?: '—') ?></span></div>
                    <div class="detail-item"><label><?= e(__('Comm. Reg.')) ?></label><span><?= e($customer['commercial_reg'] ?: '—') ?></span></div>
                </div>
                <?php if (!empty($customer['notes'])): ?>
                    <hr><p class="text-muted small mb-0"><?= nl2br(e($customer['notes'])) ?></p>
                <?php endif; ?>
            </div>
            <?php if ($auth->can('customers.manage')): ?>
            <div class="card-footer d-flex gap-2">
                <a href="<?= url('customers/' . $customer['id'] . '/edit') ?>" class="btn btn-sm btn-primary"><?= e(__('Edit')) ?></a>
                <form method="post" action="<?= url('customers/' . $customer['id'] . '/delete') ?>" data-confirm="Delete this customer?">
                    <?= $csrf->field() ?>
                    <button class="btn btn-sm btn-outline-danger"><?= e(__('Delete')) ?></button>
                </form>
            </div>
            <?php endif; ?>
        </div>
    </div>

    <div class="col-lg-8">
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Licenses (<?= count($licenses) ?>)</h5>
                <?php if ($auth->can('licenses.manage')): ?>
                    <a href="<?= url('licenses/create') ?>" class="btn btn-sm btn-primary"><?= e(__('+ New License')) ?></a>
                <?php endif; ?>
            </div>
            <div class="table-responsive">
                <table class="table table-hover mb-0 align-middle">
                    <thead><tr><th><?= e(__('Number')) ?></th><th><?= e(__('Product')) ?></th><th><?= e(__('Type')) ?></th><th><?= e(__('Expiry')) ?></th><th><?= e(__('Status')) ?></th></tr></thead>
                    <tbody>
                        <?php foreach ($licenses as $l): ?>
                        <tr>
                            <td><a href="<?= url('licenses/' . $l['id']) ?>" class="text-decoration-none mono"><?= e($l['license_number']) ?></a></td>
                            <td><?= e($l['product_name']) ?></td>
                            <td><?= e(__(ucwords(str_replace('_', ' ', $l['type'])))) ?></td>
                            <td><?= $l['expire_date'] ? human_date($l['expire_date']) : '<span class="text-muted">Lifetime</span>' ?></td>
                            <td><span class="badge <?= status_badge($l['status']) ?>"><?= e(__(ucfirst($l['status']))) ?></span></td>
                        </tr>
                        <?php endforeach; ?>
                        <?php if ($licenses === []): ?><tr><td colspan="5" class="empty-state"><?= e(__('No licenses for this customer.')) ?></td></tr><?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>
