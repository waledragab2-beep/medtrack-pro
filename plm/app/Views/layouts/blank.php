<?php
/**
 * Minimal layout for standalone pages (errors, print, certificate).
 *
 * @var string $content
 * @var string $title
 */
?>
<!DOCTYPE html>
<html lang="en" dir="ltr" data-bs-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= e($title ?? config('app.name')) ?></title>
    <link rel="stylesheet" href="<?= asset('css/bootstrap.min.css') ?>">
    <link rel="stylesheet" href="<?= asset('css/app.css') ?>">
</head>
<body class="blank-body">
    <?= $content ?>
</body>
</html>
