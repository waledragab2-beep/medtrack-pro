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
use App\Models\Backup;
use App\Services\AuditService;
use App\Services\BackupService;

/**
 * Backup and restore management.
 *
 * @package App\Controllers
 */
final class BackupController extends Controller
{
    public function __construct(
        View $view,
        Session $session,
        Csrf $csrf,
        Auth $auth,
        Translator $translator,
        private Backup $backups,
        private BackupService $backupService,
        private AuditService $audit
    ) {
        parent::__construct($view, $session, $csrf, $auth, $translator);
    }

    public function index(Request $request, Response $response): Response
    {
        return $this->render($response, 'settings/backups', [
            'title'   => 'Backups & Restore',
            'backups' => $this->backups->allWithUser(),
            'active'  => 'settings',
        ]);
    }

    public function backupDatabase(Request $request, Response $response): Response
    {
        try {
            $filename = $this->backupService->backupDatabase($this->auth->id());
            $this->audit->log('backup', 'Created database backup ' . $filename, 'backup');
            $this->session->flash('success', 'Database backup created: ' . $filename);
        } catch (\Throwable $e) {
            $this->session->flash('error', 'Backup failed: ' . $e->getMessage());
        }
        return $this->redirect($response, '/backups');
    }

    public function backupFiles(Request $request, Response $response): Response
    {
        try {
            $filename = $this->backupService->backupFiles($this->auth->id());
            $this->audit->log('backup', 'Created files backup ' . $filename, 'backup');
            $this->session->flash('success', 'Files backup created: ' . $filename);
        } catch (\Throwable $e) {
            $this->session->flash('error', 'Backup failed: ' . $e->getMessage());
        }
        return $this->redirect($response, '/backups');
    }

    public function download(Request $request, Response $response): Response
    {
        $filename = basename((string) $request->route('filename'));
        $path     = $this->backupService->path($filename);
        if (!is_file($path)) {
            return $this->notFound($response);
        }

        $this->audit->log('export', 'Downloaded backup ' . $filename, 'backup');
        return $response->download($path, $filename, 'application/octet-stream');
    }

    public function destroy(Request $request, Response $response): Response
    {
        $filename = basename((string) $request->route('filename'));
        $this->backupService->delete($filename);
        $this->audit->log('delete', 'Deleted backup ' . $filename, 'backup');
        $this->session->flash('success', 'Backup deleted.');
        return $this->redirect($response, '/backups');
    }

    public function restore(Request $request, Response $response): Response
    {
        if (!$this->auth->isSuperAdmin()) {
            $this->session->flash('error', 'Only a super administrator may restore backups.');
            return $this->redirect($response, '/backups');
        }

        $file = $request->file('backup_file');
        if ($file === null || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            $this->session->flash('error', 'Please select a valid .sql backup file.');
            return $this->redirect($response, '/backups');
        }

        try {
            $count = $this->backupService->restoreDatabase((string) $file['tmp_name']);
            $this->audit->log('restore', 'Restored database from uploaded backup', 'backup');
            $this->session->flash('success', "Database restored ({$count} statements executed).");
        } catch (\Throwable $e) {
            $this->session->flash('error', 'Restore failed: ' . $e->getMessage());
        }

        return $this->redirect($response, '/backups');
    }

    private function notFound(Response $response): Response
    {
        return $response->status(404)->body(
            $this->view->render('errors/404', $this->viewDefaults(), 'layouts/app')
        );
    }
}
