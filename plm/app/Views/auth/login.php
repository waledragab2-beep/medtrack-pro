<?php
/**
 * Login form.
 *
 * @var App\Core\Csrf $csrf
 * @var array<string,string[]> $flashes
 */
?>
<div class="auth-header">
    <div class="auth-logo"><?= icon('key') ?></div>
    <h1><?= e(__('Prima License Manager')) ?></h1>
    <p><?= e(__('Sign in to your account')) ?></p>
</div>

<?php include dirname(__DIR__) . '/partials/flash.php'; ?>

<form action="<?= url('login') ?>" method="post" class="auth-form" autocomplete="off">
    <?= $csrf->field() ?>
    <div class="mb-3">
        <label for="username" class="form-label"><?= e(__('Username or Email')) ?></label>
        <input type="text" class="form-control form-control-lg" id="username" name="username" required autofocus>
    </div>
    <div class="mb-3">
        <label for="password" class="form-label"><?= e(__('Password')) ?></label>
        <div class="input-group">
            <input type="password" class="form-control form-control-lg" id="password" name="password" required>
            <button class="btn btn-outline-secondary" type="button" data-toggle-password="#password" tabindex="-1"><?= e(__('Show')) ?></button>
        </div>
    </div>
    <div class="d-flex justify-content-between align-items-center mb-3">
        <div class="form-check">
            <input class="form-check-input" type="checkbox" id="remember" name="remember">
            <label class="form-check-label" for="remember"><?= e(__('Remember me')) ?></label>
        </div>
    </div>
    <button type="submit" class="btn btn-primary btn-lg w-100"><?= e(__('Sign In')) ?></button>
</form>
