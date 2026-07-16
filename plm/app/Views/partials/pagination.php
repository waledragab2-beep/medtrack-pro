<?php
/**
 * Pagination control.
 *
 * @var array{total:int,page:int,per_page:int,pages:int} $result
 */
if (!isset($result) || ($result['pages'] ?? 1) <= 1) {
    return;
}
$page  = (int) $result['page'];
$pages = (int) $result['pages'];
$query = $_GET;
$build = static function (int $p) use ($query): string {
    $query['page'] = $p;
    return '?' . http_build_query($query);
};
$start = max(1, $page - 2);
$end   = min($pages, $page + 2);
?>
<nav class="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2" aria-label="Pagination">
    <small class="text-muted">
        Showing page <?= $page ?> of <?= $pages ?> · <?= number_format($result['total']) ?> records
    </small>
    <ul class="pagination mb-0">
        <li class="page-item <?= $page <= 1 ? 'disabled' : '' ?>">
            <a class="page-link" href="<?= $page <= 1 ? '#' : e($build($page - 1)) ?>">&laquo;</a>
        </li>
        <?php if ($start > 1): ?>
            <li class="page-item"><a class="page-link" href="<?= e($build(1)) ?>">1</a></li>
            <?php if ($start > 2): ?><li class="page-item disabled"><span class="page-link">…</span></li><?php endif; ?>
        <?php endif; ?>
        <?php for ($i = $start; $i <= $end; $i++): ?>
            <li class="page-item <?= $i === $page ? 'active' : '' ?>">
                <a class="page-link" href="<?= e($build($i)) ?>"><?= $i ?></a>
            </li>
        <?php endfor; ?>
        <?php if ($end < $pages): ?>
            <?php if ($end < $pages - 1): ?><li class="page-item disabled"><span class="page-link">…</span></li><?php endif; ?>
            <li class="page-item"><a class="page-link" href="<?= e($build($pages)) ?>"><?= $pages ?></a></li>
        <?php endif; ?>
        <li class="page-item <?= $page >= $pages ? 'disabled' : '' ?>">
            <a class="page-link" href="<?= $page >= $pages ? '#' : e($build($page + 1)) ?>">&raquo;</a>
        </li>
    </ul>
</nav>
