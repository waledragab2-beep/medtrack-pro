<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Translator;
use App\Core\Controller;
use App\Core\Csrf;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Core\View;
use App\Models\Setting;
use App\Services\AuditService;
use App\Services\EncryptionService;
use App\Services\MailService;

/**
 * System settings management (company profile, SMTP, general, license).
 *
 * @package App\Controllers
 */
final class SettingsController extends Controller
{
    public function __construct(
        View $view,
        Session $session,
        Csrf $csrf,
        Auth $auth,
        Translator $translator,
        private Setting $settings,
        private EncryptionService $crypto,
        private MailService $mail,
        private AuditService $audit
    ) {
        parent::__construct($view, $session, $csrf, $auth, $translator);
    }

    public function index(Request $request, Response $response): Response
    {
        return $this->render($response, 'settings/index', [
            'title'    => 'Settings',
            'grouped'  => $this->settings->grouped(),
            'settings' => $this->settings->allMap(),
            'keysExist' => $this->crypto->keysExist(),
            'active'   => 'settings',
        ]);
    }

    public function update(Request $request, Response $response): Response
    {
        $input   = $request->all();
        $updates = [];

        // Only persist known setting keys.
        foreach ($this->settings->all() as $setting) {
            $key = $setting['key_name'];
            if (array_key_exists($key, $input)) {
                $updates[$key] = $input[$key];
            }
        }

        // Handle logo upload.
        $logo = $request->file('company_logo');
        if ($logo !== null && ($logo['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK) {
            $stored = $this->storeLogo($logo);
            if ($stored !== null) {
                $updates['company_logo'] = $stored;
            }
        }

        $this->settings->updateMany($updates);
        $this->audit->log('update', 'Updated system settings', 'settings');
        $this->session->flash('success', 'Settings saved.');

        return $this->redirect($response, '/settings');
    }

    public function testMail(Request $request, Response $response): Response
    {
        $to = (string) $request->input('test_email', '');
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            return $this->json($response, ['success' => false, 'message' => 'Invalid email address.'], 422);
        }

        $ok = $this->mail->send(
            $to,
            'PLM SMTP Test',
            '<h2>SMTP Test Successful</h2><p>Your Prima License Manager email configuration is working.</p>'
        );

        return $this->json($response, [
            'success' => $ok,
            'message' => $ok ? 'Test email sent successfully.' : 'Failed to send test email. Check SMTP settings.',
        ]);
    }

    public function regenerateKeys(Request $request, Response $response): Response
    {
        if (!$this->auth->isSuperAdmin()) {
            $this->session->flash('error', 'Only a super administrator may regenerate keys.');
            return $this->redirect($response, '/settings');
        }

        $this->crypto->generateKeyPair();
        $this->audit->log('security', 'Regenerated RSA encryption keys', 'settings');
        $this->session->flash('warning', 'Encryption keys regenerated. Existing license files must be re-issued.');

        return $this->redirect($response, '/settings');
    }

    /**
     * @param array<string, mixed> $file
     */
    private function storeLogo(array $file): ?string
    {
        $allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];
        $mime    = mime_content_type($file['tmp_name']) ?: '';
        if (!in_array($mime, $allowed, true)) {
            $this->session->flash('error', 'Logo must be an image file.');
            return null;
        }

        $ext     = pathinfo((string) $file['name'], PATHINFO_EXTENSION) ?: 'png';
        $name    = 'logo-' . time() . '.' . preg_replace('/[^a-z0-9]/i', '', $ext);
        $dir     = (string) config('paths.uploads');
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        move_uploaded_file($file['tmp_name'], $dir . '/' . $name);

        return 'uploads/' . $name;
    }
}
