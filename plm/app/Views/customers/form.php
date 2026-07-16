<?php
/**
 * Customer create/edit form.
 *
 * @var array<string,mixed>|null $customer
 * @var App\Core\Csrf $csrf
 */
$c = $customer ?? [];
$isEdit = !empty($c);
$action = $isEdit ? url('customers/' . $c['id'] . '/update') : url('customers');
?>
<div class="card">
    <div class="card-body">
        <form method="post" action="<?= e($action) ?>">
            <?= $csrf->field() ?>

            <div class="form-section">
                <div class="form-section-title">Company Information</div>
                <div class="row g-3">
                    <div class="col-md-6"><label class="form-label">Company Name *</label><input class="form-control" name="company_name" value="<?= e($c['company_name'] ?? '') ?>" required></div>
                    <div class="col-md-6"><label class="form-label">Contact Person</label><input class="form-control" name="contact_person" value="<?= e($c['contact_person'] ?? '') ?>"></div>
                    <div class="col-md-4"><label class="form-label">Phone</label><input class="form-control" name="phone" value="<?= e($c['phone'] ?? '') ?>"></div>
                    <div class="col-md-4"><label class="form-label">Mobile</label><input class="form-control" name="mobile" value="<?= e($c['mobile'] ?? '') ?>"></div>
                    <div class="col-md-4"><label class="form-label">Email</label><input type="email" class="form-control" name="email" value="<?= e($c['email'] ?? '') ?>"></div>
                    <div class="col-md-6"><label class="form-label">Website</label><input class="form-control" name="website" value="<?= e($c['website'] ?? '') ?>"></div>
                    <div class="col-md-6">
                        <label class="form-label">Status</label>
                        <select class="form-select" name="status">
                            <?php foreach (['active', 'inactive', 'suspended'] as $s): ?>
                                <option value="<?= $s ?>" <?= ($c['status'] ?? 'active') === $s ? 'selected' : '' ?>><?= ucfirst($s) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                </div>
            </div>

            <div class="form-section">
                <div class="form-section-title">Location &amp; Legal</div>
                <div class="row g-3">
                    <div class="col-md-4"><label class="form-label">Country</label><input class="form-control" name="country" value="<?= e($c['country'] ?? '') ?>"></div>
                    <div class="col-md-4"><label class="form-label">City</label><input class="form-control" name="city" value="<?= e($c['city'] ?? '') ?>"></div>
                    <div class="col-md-4"><label class="form-label">Address</label><input class="form-control" name="address" value="<?= e($c['address'] ?? '') ?>"></div>
                    <div class="col-md-6"><label class="form-label">VAT Number</label><input class="form-control" name="vat_number" value="<?= e($c['vat_number'] ?? '') ?>"></div>
                    <div class="col-md-6"><label class="form-label">Commercial Registration</label><input class="form-control" name="commercial_reg" value="<?= e($c['commercial_reg'] ?? '') ?>"></div>
                    <div class="col-12"><label class="form-label">Notes</label><textarea class="form-control" name="notes" rows="3"><?= e($c['notes'] ?? '') ?></textarea></div>
                </div>
            </div>

            <div class="d-flex gap-2">
                <button type="submit" class="btn btn-primary"><?= $isEdit ? 'Update' : 'Create' ?> Customer</button>
                <a href="<?= url('customers') ?>" class="btn btn-outline-secondary">Cancel</a>
            </div>
        </form>
    </div>
</div>
