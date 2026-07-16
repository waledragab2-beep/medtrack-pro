<?php
/**
 * Page header with title and breadcrumb.
 *
 * @var string $title
 * @var string $active
 */
$active = $active ?? '';
?>
<div class="page-header">
    <div>
        <h1 class="page-title"><?= e(__($title ?? 'Page')) ?></h1>
        <nav aria-label="breadcrumb">
            <ol class="breadcrumb mb-0">
                <li class="breadcrumb-item"><a href="<?= url('dashboard') ?>"><?= e(__('Home')) ?></a></li>
                <?php if ($active !== 'dashboard'): ?>
                    <li class="breadcrumb-item active" aria-current="page"><?= e(__(ucfirst($active))) ?></li>
                <?php endif; ?>
            </ol>
        </nav>
    </div>
    <div class="page-header-actions" id="pageActions"></div>
</div>
