<?php
/**
 * Report table with export actions.
 *
 * @var string $type
 * @var string[] $headers
 * @var array<int,array<int,mixed>> $rows
 */
?>
<div class="card">
    <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h5 class="mb-0"><?= e($title) ?> <span class="badge bg-secondary"><?= count($rows) ?></span></h5>
        <div class="btn-group">
            <a href="<?= url('reports/' . $type . '/export/csv') ?>" class="btn btn-sm btn-outline-primary">CSV</a>
            <a href="<?= url('reports/' . $type . '/export/excel') ?>" class="btn btn-sm btn-outline-primary">Excel</a>
            <a href="<?= url('reports/' . $type . '/export/pdf') ?>" target="_blank" class="btn btn-sm btn-outline-primary">PDF / Print</a>
        </div>
    </div>
    <div class="table-responsive">
        <table class="table table-hover align-middle mb-0" data-datatable>
            <thead><tr><?php foreach ($headers as $h): ?><th><?= e($h) ?></th><?php endforeach; ?></tr></thead>
            <tbody>
                <?php foreach ($rows as $row): ?>
                    <tr><?php foreach ($row as $cell): ?><td><?= e((string) $cell) ?></td><?php endforeach; ?></tr>
                <?php endforeach; ?>
                <?php if ($rows === []): ?><tr><td colspan="<?= count($headers) ?>" class="empty-state">No data available.</td></tr><?php endif; ?>
            </tbody>
        </table>
    </div>
</div>
<a href="<?= url('reports') ?>" class="btn btn-link mt-3">&larr; Back to reports</a>
