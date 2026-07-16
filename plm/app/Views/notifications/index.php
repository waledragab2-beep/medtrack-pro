<?php
/**
 * Notifications centre.
 *
 * @var array<int,array<string,mixed>> $items
 * @var App\Core\Csrf $csrf
 */
?>
<div class="card">
    <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="mb-0">All Notifications</h5>
        <form method="post" action="<?= url('notifications/read-all') ?>"><?= $csrf->field() ?><button class="btn btn-sm btn-outline-secondary">Mark all read</button></form>
    </div>
    <div class="list-group list-group-flush">
        <?php foreach ($items as $n): ?>
            <div class="list-group-item d-flex justify-content-between align-items-start <?= (int) $n['is_read'] ? '' : 'fw-semibold' ?>">
                <div>
                    <div><span class="badge <?= status_badge($n['type']) ?> me-2"><?= e($n['type']) ?></span><?= e($n['title']) ?></div>
                    <small class="text-muted d-block mt-1"><?= e($n['message'] ?: '') ?></small>
                    <small class="text-muted"><?= human_date($n['created_at'], 'Y-m-d H:i') ?></small>
                </div>
                <?php if (!(int) $n['is_read']): ?>
                    <form method="post" action="<?= url('notifications/' . $n['id'] . '/read') ?>"><?= $csrf->field() ?><button class="btn btn-sm btn-link">Mark read</button></form>
                <?php endif; ?>
            </div>
        <?php endforeach; ?>
        <?php if ($items === []): ?><div class="list-group-item empty-state">No notifications.</div><?php endif; ?>
    </div>
</div>
