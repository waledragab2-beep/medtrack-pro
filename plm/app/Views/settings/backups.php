<?php
/**
 * Backups & restore.
 *
 * @var array<int,array<string,mixed>> $backups
 * @var App\Core\Auth $auth
 * @var App\Core\Csrf $csrf
 */
$fmt = static fn (int $b): string => $b > 1048576 ? round($b / 1048576, 2) . ' MB' : round($b / 1024, 1) . ' KB';
?>
<div class="row g-4">
    <div class="col-lg-4">
        <div class="card mb-4">
            <div class="card-header"><h6 class="mb-0">Create Backup</h6></div>
            <div class="card-body d-grid gap-2">
                <form method="post" action="<?= url('backups/database') ?>"><?= $csrf->field() ?><button class="btn btn-primary w-100">Backup Database</button></form>
                <form method="post" action="<?= url('backups/files') ?>"><?= $csrf->field() ?><button class="btn btn-outline-primary w-100">Backup Uploaded Files</button></form>
            </div>
        </div>
        <?php if ($auth->isSuperAdmin()): ?>
        <div class="card">
            <div class="card-header"><h6 class="mb-0">Restore Database</h6></div>
            <div class="card-body">
                <form method="post" action="<?= url('backups/restore') ?>" enctype="multipart/form-data" data-confirm="Restoring will overwrite current data. Continue?">
                    <?= $csrf->field() ?>
                    <input type="file" class="form-control mb-2" name="backup_file" accept=".sql" required>
                    <button class="btn btn-outline-danger w-100">Restore</button>
                </form>
                <p class="text-muted small mt-2 mb-0">Upload a .sql backup created by this system.</p>
            </div>
        </div>
        <?php endif; ?>
    </div>

    <div class="col-lg-8">
        <div class="card">
            <div class="card-header"><h6 class="mb-0">Backup History</h6></div>
            <div class="table-responsive">
                <table class="table table-hover mb-0 align-middle">
                    <thead><tr><th>Filename</th><th>Type</th><th>Size</th><th>Created By</th><th>Date</th><th class="text-end">Actions</th></tr></thead>
                    <tbody>
                        <?php foreach ($backups as $b): ?>
                        <tr>
                            <td class="mono small"><?= e($b['filename']) ?></td>
                            <td><span class="badge bg-light text-dark border"><?= e(ucfirst($b['type'])) ?></span></td>
                            <td><?= $fmt((int) $b['size_bytes']) ?></td>
                            <td><?= e($b['created_by_name'] ?: 'System') ?></td>
                            <td class="small"><?= human_date($b['created_at'], 'Y-m-d H:i') ?></td>
                            <td class="text-end">
                                <a href="<?= url('backups/' . rawurlencode($b['filename']) . '/download') ?>" class="btn btn-sm btn-outline-primary">Download</a>
                                <form method="post" action="<?= url('backups/' . rawurlencode($b['filename']) . '/delete') ?>" class="d-inline" data-confirm="Delete this backup?"><?= $csrf->field() ?><button class="btn btn-sm btn-outline-danger">Delete</button></form>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                        <?php if ($backups === []): ?><tr><td colspan="6" class="empty-state">No backups yet.</td></tr><?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>
