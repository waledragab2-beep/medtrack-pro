<?php
/**
 * Authentication layout (login screen).
 *
 * @var string $content
 * @var string $title
 * @var array<string,string[]> $flashes
 */
?>
<!DOCTYPE html>
<html lang="<?= e(lang()) ?>" dir="<?= is_rtl() ? 'rtl' : 'ltr' ?>" data-bs-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= e(__($title ?? 'Sign In')) ?> — <?= e(config('app.name')) ?></title>
    <link rel="icon" href="<?= asset('images/favicon.svg') ?>" type="image/svg+xml">
    <link rel="stylesheet" href="<?= is_rtl() ? asset('css/bootstrap.rtl.min.css') : asset('css/bootstrap.min.css') ?>">
    <link rel="stylesheet" href="<?= asset('css/app.css') ?>">
</head>
<body class="auth-body">
    <div class="auth-wrapper">
        <div class="auth-card">
            <?= $content ?>
        </div>
        <p class="auth-copyright">&copy; <?= date('Y') ?> <?= e(config('app.name')) ?> · v<?= e(config('app.version')) ?></p>
    </div>
    <script src="<?= asset('js/bootstrap.bundle.min.js') ?>"></script>
</body>
</html>
