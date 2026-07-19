<?php
/**
 * Top navigation bar.
 *
 * @var array<string,mixed>|null $user
 * @var App\Core\Csrf $csrf
 */
?>
<header class="app-topnav">
    <div class="topnav-left">
        <button class="topnav-toggle" id="sidebarToggle" aria-label="Toggle menu">
            <span></span><span></span><span></span>
        </button>
        <form class="topnav-search" action="<?= url('licenses') ?>" method="get" role="search">
            <?= icon('list') ?>
            <input type="search" name="q" placeholder="<?= e(__('Search licenses…')) ?>" aria-label="<?= e(__('Search')) ?>" autocomplete="off">
        </form>
    </div>

    <div class="topnav-right">
        <button class="topnav-btn" id="themeToggle" title="Toggle theme" aria-label="Toggle theme">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M6 .278a.77.77 0 0 1 .08.858 7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 0 1 .81.316.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.75.75 0 0 1 6 .278"/></svg>
        </button>

        <div class="dropdown topnav-notif">
            <button class="topnav-btn position-relative" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Notifications">
                <?= icon('bell') ?>
                <span class="notif-badge d-none" id="notifBadge">0</span>
            </button>
            <div class="dropdown-menu dropdown-menu-end notif-menu" id="notifMenu">
                <div class="notif-header d-flex justify-content-between align-items-center">
                    <strong><?= e(__('Notifications')) ?></strong>
                    <a href="<?= url('notifications') ?>" class="small"><?= e(__('View all')) ?></a>
                </div>
                <div class="notif-list" id="notifList">
                    <div class="notif-empty text-muted small p-3"><?= e(__('No new notifications.')) ?></div>
                </div>
            </div>
        </div>

        <div class="dropdown topnav-user">
            <button class="user-btn" data-bs-toggle="dropdown" aria-expanded="false">
                <span class="user-avatar"><?= e(strtoupper(mb_substr((string) ($user['name'] ?? 'U'), 0, 1))) ?></span>
                <span class="user-meta d-none d-md-flex">
                    <span class="user-name"><?= e($user['name'] ?? 'User') ?></span>
                    <span class="user-role"><?= e($user['role_name'] ?? '') ?></span>
                </span>
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
                <li><a class="dropdown-item" href="<?= url('profile') ?>"><?= e(__('My Profile')) ?></a></li>
                <li><a class="dropdown-item" href="<?= url('settings') ?>"><?= e(__('Settings')) ?></a></li>
                <li><hr class="dropdown-divider"></li>
                <li>
                    <form action="<?= url('logout') ?>" method="post" class="px-1">
                        <?= $csrf->field() ?>
                        <button type="submit" class="dropdown-item text-danger"><?= icon('logout') ?> <?= e(__('Sign out')) ?></button>
                    </form>
                </li>
            </ul>
        </div>
    </div>
</header>
