<?php
/**
 * User profile self-service.
 *
 * @var array<string,mixed>|null $profile
 * @var App\Core\Csrf $csrf
 */
$p = $profile ?? [];
?>
<div class="row g-4">
    <div class="col-lg-6">
        <div class="card">
            <div class="card-header"><h6 class="mb-0">Profile Information</h6></div>
            <div class="card-body">
                <form method="post" action="<?= url('profile') ?>">
                    <?= $csrf->field() ?>
                    <div class="mb-3"><label class="form-label">Full Name</label><input class="form-control" name="name" value="<?= e($p['name'] ?? '') ?>" required></div>
                    <div class="mb-3"><label class="form-label">Email</label><input type="email" class="form-control" name="email" value="<?= e($p['email'] ?? '') ?>" required></div>
                    <div class="mb-3"><label class="form-label">Phone</label><input class="form-control" name="phone" value="<?= e($p['phone'] ?? '') ?>"></div>
                    <div class="mb-3"><label class="form-label">Username</label><input class="form-control mono" value="<?= e($p['username'] ?? '') ?>" disabled></div>
                    <div class="mb-3"><label class="form-label">Role</label><input class="form-control" value="<?= e($p['role_name'] ?? '') ?>" disabled></div>
                    <button class="btn btn-primary">Save Profile</button>
                </form>
            </div>
        </div>
    </div>
    <div class="col-lg-6">
        <div class="card mb-4">
            <div class="card-header"><h6 class="mb-0">Change Password</h6></div>
            <div class="card-body">
                <form method="post" action="<?= url('profile/password') ?>" autocomplete="off">
                    <?= $csrf->field() ?>
                    <div class="mb-3"><label class="form-label">Current Password</label><input type="password" class="form-control" name="current_password" required></div>
                    <div class="mb-3"><label class="form-label">New Password</label><input type="password" class="form-control" name="password" minlength="8" required></div>
                    <div class="mb-3"><label class="form-label">Confirm New Password</label><input type="password" class="form-control" name="password_confirmation" required></div>
                    <button class="btn btn-primary">Update Password</button>
                </form>
            </div>
        </div>
        <div class="card">
            <div class="card-header"><h6 class="mb-0">Preferences</h6></div>
            <div class="card-body">
                <form method="post" action="<?= url('profile/preferences') ?>">
                    <?= $csrf->field() ?>
                    <div class="row g-3">
                        <div class="col-6">
                            <label class="form-label">Language</label>
                            <select class="form-select" name="locale"><option value="en" <?= ($p['locale'] ?? 'en') === 'en' ? 'selected' : '' ?>>English</option><option value="ar" <?= ($p['locale'] ?? '') === 'ar' ? 'selected' : '' ?>>العربية</option></select>
                        </div>
                        <div class="col-6">
                            <label class="form-label">Theme</label>
                            <select class="form-select" name="theme"><option value="light" <?= ($p['theme'] ?? 'light') === 'light' ? 'selected' : '' ?>>Light</option><option value="dark" <?= ($p['theme'] ?? '') === 'dark' ? 'selected' : '' ?>>Dark</option></select>
                        </div>
                    </div>
                    <button class="btn btn-primary mt-3">Save Preferences</button>
                </form>
            </div>
        </div>
    </div>
</div>
