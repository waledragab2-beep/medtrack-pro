<?php
/**
 * Installation wizard step renderer.
 *
 * @var int $step
 * @var App\Core\Csrf $csrf
 * @var array<string,string[]> $flashes
 * @var array<int,array{label:string,ok:bool,detail:string}> $checks
 * @var array<string,mixed> $db
 */
$steps = [1 => 'Requirements', 2 => 'Database', 3 => 'Administrator', 4 => 'Encryption Keys', 5 => 'Install', 6 => 'Finish'];
?>
<div class="install-steps">
    <?php foreach ($steps as $num => $label): ?>
        <div class="install-step <?= $num < $step ? 'done' : ($num === $step ? 'current' : '') ?>">
            <span class="step-num"><?= $num < $step ? '&checkmark;' : $num ?></span>
            <span class="step-label"><?= e($label) ?></span>
        </div>
    <?php endforeach; ?>
</div>

<?php include dirname(__DIR__) . '/partials/flash.php'; ?>

<?php if ($step === 1): ?>
    <h3>Server Requirements</h3>
    <p class="text-muted">Verify your hosting environment meets the requirements.</p>
    <ul class="req-list">
        <?php $allOk = true; foreach ($checks as $check): $allOk = $allOk && $check['ok']; ?>
            <li class="<?= $check['ok'] ? 'ok' : 'fail' ?>">
                <span class="req-status"><?= $check['ok'] ? '&#10003;' : '&#10007;' ?></span>
                <span class="req-label"><?= e($check['label']) ?></span>
                <span class="req-detail"><?= e($check['detail']) ?></span>
            </li>
        <?php endforeach; ?>
    </ul>
    <form action="<?= url('install/requirements') ?>" method="post">
        <?= $csrf->field() ?>
        <button type="submit" class="btn btn-primary" <?= $allOk ? '' : '' ?>>Continue &rarr;</button>
        <?php if (!$allOk): ?><p class="text-danger small mt-2">Some checks failed. You may continue, but the application might not function correctly.</p><?php endif; ?>
    </form>

<?php elseif ($step === 2): ?>
    <h3>Database Configuration</h3>
    <p class="text-muted">Enter your MySQL connection details. The database will be created if it does not exist.</p>
    <form action="<?= url('install/database') ?>" method="post">
        <?= $csrf->field() ?>
        <div class="row g-3">
            <div class="col-md-8"><label class="form-label"><?= e(__('Host')) ?></label><input class="form-control" name="db_host" value="<?= e($db['host'] ?? 'localhost') ?>" required></div>
            <div class="col-md-4"><label class="form-label"><?= e(__('Port')) ?></label><input class="form-control" name="db_port" value="<?= e($db['port'] ?? '3306') ?>" required></div>
            <div class="col-12"><label class="form-label"><?= e(__('Database Name')) ?></label><input class="form-control" name="db_name" value="<?= e($db['database'] ?? 'plm') ?>" required></div>
            <div class="col-md-6"><label class="form-label"><?= e(__('Username')) ?></label><input class="form-control" name="db_user" value="<?= e($db['username'] ?? 'root') ?>" required></div>
            <div class="col-md-6"><label class="form-label"><?= e(__('Password')) ?></label><input type="password" class="form-control" name="db_pass" value=""></div>
        </div>
        <button type="submit" class="btn btn-primary mt-3">Test &amp; Continue &rarr;</button>
    </form>

<?php elseif ($step === 3): ?>
    <h3>Create Administrator</h3>
    <p class="text-muted">This account will have full super-administrator access.</p>
    <form action="<?= url('install/admin') ?>" method="post">
        <?= $csrf->field() ?>
        <div class="row g-3">
            <div class="col-md-6"><label class="form-label"><?= e(__('Full Name')) ?></label><input class="form-control" name="admin_name" required></div>
            <div class="col-md-6"><label class="form-label"><?= e(__('Username')) ?></label><input class="form-control" name="admin_username" required></div>
            <div class="col-12"><label class="form-label"><?= e(__('Email')) ?></label><input type="email" class="form-control" name="admin_email" required></div>
            <div class="col-12"><label class="form-label"><?= e(__('Password (min 8 chars)')) ?></label><input type="password" class="form-control" name="admin_password" minlength="8" required></div>
        </div>
        <button type="submit" class="btn btn-primary mt-3">Continue &rarr;</button>
    </form>

<?php elseif ($step === 4): ?>
    <h3>Encryption Keys</h3>
    <p class="text-muted">A unique application secret and an RSA-4096 key pair will be generated to sign and encrypt licenses. This may take a few seconds.</p>
    <form action="<?= url('install/keys') ?>" method="post">
        <?= $csrf->field() ?>
        <button type="submit" class="btn btn-primary">Generate Keys &rarr;</button>
    </form>

<?php elseif ($step === 5): ?>
    <h3>Install Database</h3>
    <p class="text-muted">Ready to import the schema, seed data and create your administrator account.</p>
    <form action="<?= url('install/finish') ?>" method="post">
        <?= $csrf->field() ?>
        <button type="submit" class="btn btn-success btn-lg">Run Installation &rarr;</button>
    </form>

<?php else: ?>
    <div class="install-finish">
        <div class="finish-icon">&#10003;</div>
        <h3>Installation Complete!</h3>
        <p>Prima License Manager has been installed successfully.</p>
        <div class="alert alert-warning small text-start">
            <strong>Security:</strong> For production, delete or protect the <code>installer/</code> directory and ensure <code>storage/</code> is not web-accessible.
        </div>
        <a href="<?= url('login') ?>" class="btn btn-primary btn-lg">Go to Login &rarr;</a>
    </div>
<?php endif; ?>
