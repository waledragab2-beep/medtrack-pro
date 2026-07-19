<?php
/**
 * Flash message rendering.
 *
 * @var array<string,string[]> $flashes
 */
$flashes = $flashes ?? [];
$map = ['success' => 'success', 'error' => 'danger', 'warning' => 'warning', 'info' => 'info'];
?>
<?php foreach ($flashes as $type => $messages): ?>
    <?php foreach ($messages as $message): ?>
        <div class="alert alert-<?= $map[$type] ?? 'info' ?> alert-dismissible fade show" role="alert">
            <?= e(__($message)) ?>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    <?php endforeach; ?>
<?php endforeach; ?>
