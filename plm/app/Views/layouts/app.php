<?php
/**
 * Main authenticated application layout.
 *
 * @var string $content
 * @var array<string,mixed>|null $user
 * @var App\Core\Csrf $csrf
 * @var array<string,string[]> $flashes
 * @var string $title
 * @var string $active
 */
$locale = lang();
$theme  = $user['theme'] ?? 'light';
$dir    = is_rtl() ? 'rtl' : 'ltr';
$active = $active ?? '';
?>
<!DOCTYPE html>
<html lang="<?= e($locale) ?>" dir="<?= $dir ?>" data-bs-theme="<?= e($theme) ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="<?= e($csrf->token()) ?>">
    <title><?= e(__($title ?? 'Dashboard')) ?> — <?= e(config('app.name')) ?></title>
    <link rel="icon" href="<?= asset('images/favicon.svg') ?>" type="image/svg+xml">
    <link rel="stylesheet" href="<?= $dir === 'rtl' ? asset('css/bootstrap.rtl.min.css') : asset('css/bootstrap.min.css') ?>">
    <link rel="stylesheet" href="<?= asset('css/dataTables.bootstrap5.min.css') ?>">
    <link rel="stylesheet" href="<?= asset('css/app.css') ?>">
    <?php if ($dir === 'rtl'): ?>
    <link rel="stylesheet" href="<?= asset('css/rtl.css') ?>">
    <?php endif; ?>
</head>
<body class="app-body">
<div class="app-wrapper">
    <?php include dirname(__DIR__) . '/partials/sidebar.php'; ?>

    <div class="app-main">
        <?php include dirname(__DIR__) . '/partials/topnav.php'; ?>

        <main class="app-content">
            <div class="container-fluid">
                <?php include dirname(__DIR__) . '/partials/breadcrumb.php'; ?>
                <?php include dirname(__DIR__) . '/partials/flash.php'; ?>
                <?= $content ?>
            </div>
        </main>

        <footer class="app-footer">
            <div class="container-fluid d-flex justify-content-between">
                <span>&copy; <?= date('Y') ?> <?= e(config('app.name')) ?> v<?= e(config('app.version')) ?></span>
                <span class="text-muted"><?= e(__('Offline License & Activation Management')) ?></span>
            </div>
        </footer>
    </div>
</div>

<script src="<?= asset('js/jquery.min.js') ?>"></script>
<script src="<?= asset('js/bootstrap.bundle.min.js') ?>"></script>
<script src="<?= asset('js/dataTables.min.js') ?>"></script>
<script src="<?= asset('js/dataTables.bootstrap5.min.js') ?>"></script>
<script src="<?= asset('js/chart.min.js') ?>"></script>
<script src="<?= asset('js/app.js') ?>"></script>
</body>
</html>
