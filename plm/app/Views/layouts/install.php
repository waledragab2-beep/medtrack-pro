<?php
/**
 * Installer layout.
 *
 * @var string $content
 * @var string $title
 * @var array<string,string[]> $flashes
 */
?>
<!DOCTYPE html>
<html lang="en" dir="ltr" data-bs-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Install — <?= e(config('app.name')) ?></title>
    <link rel="stylesheet" href="<?= asset('css/bootstrap.min.css') ?>">
    <link rel="stylesheet" href="<?= asset('css/app.css') ?>">
</head>
<body class="install-body">
    <div class="install-wrapper">
        <div class="install-brand">
            <h1>Prima License Manager</h1>
            <p>Installation Wizard · v<?= e(config('app.version')) ?></p>
        </div>
        <div class="install-card">
            <?= $content ?>
        </div>
    </div>
    <script src="<?= asset('js/bootstrap.bundle.min.js') ?>"></script>
</body>
</html>
