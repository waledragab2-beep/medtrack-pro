<?php
/**
 * 500 error page.
 *
 * @var string|null $message
 * @var string|null $trace
 */
?>
<div class="error-page">
    <div class="error-code">500</div>
    <h2>Something Went Wrong</h2>
    <p class="text-muted">An unexpected error occurred. The issue has been logged.</p>
    <?php if (!empty($message)): ?>
        <div class="alert alert-danger text-start mx-auto" style="max-width:700px">
            <strong>Debug:</strong> <?= e($message) ?>
            <?php if (!empty($trace)): ?><pre class="small mt-2 mb-0" style="white-space:pre-wrap"><?= e($trace) ?></pre><?php endif; ?>
        </div>
    <?php endif; ?>
    <a href="<?= url('dashboard') ?>" class="btn btn-primary">Back to Dashboard</a>
</div>
