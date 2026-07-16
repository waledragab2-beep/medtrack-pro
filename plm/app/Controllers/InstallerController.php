<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Csrf;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Core\View;
use App\Services\EncryptionService;
use PDO;
use Throwable;

/**
 * Installation wizard.
 *
 * A self-contained, six-step installer that performs a server requirement
 * check, configures and provisions the database, creates the first
 * administrator, generates encryption keys and finalises the installation.
 *
 * It deliberately avoids the Auth/Database services (which are unavailable
 * pre-install) and manages persistence directly.
 *
 * @package App\Controllers
 */
final class InstallerController
{
    private string $lockFile;

    public function __construct(
        private View $view,
        private Session $session,
        private Csrf $csrf
    ) {
        $this->lockFile = (string) config('paths.storage') . '/installed.lock';
    }

    public function index(Request $request, Response $response): Response
    {
        if ($this->isInstalled()) {
            return $response->redirect(url('login'));
        }
        return $this->step($request, $response);
    }

    public function step(Request $request, Response $response): Response
    {
        if ($this->isInstalled()) {
            return $response->redirect(url('login'));
        }

        $step = (int) ($request->route('step') ?? $this->session->get('install_step', 1));
        $step = max(1, min(6, $step));

        return $this->renderStep($response, $step);
    }

    public function requirements(Request $request, Response $response): Response
    {
        $this->session->set('install_step', 2);
        return $response->redirect(url('install/step/2'));
    }

    public function database(Request $request, Response $response): Response
    {
        $config = [
            'host'     => (string) $request->input('db_host', '127.0.0.1'),
            'port'     => (int) $request->input('db_port', 3306),
            'database' => (string) $request->input('db_name', ''),
            'username' => (string) $request->input('db_user', ''),
            'password' => (string) $request->input('db_pass', ''),
        ];

        try {
            $pdo = new PDO(
                sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $config['host'], $config['port']),
                $config['username'],
                $config['password'],
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
            );
            $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$config['database']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            $pdo->exec("USE `{$config['database']}`");
        } catch (Throwable $e) {
            $this->session->flash('error', 'Database connection failed: ' . $e->getMessage());
            return $response->redirect(url('install/step/2'));
        }

        $this->session->set('install_db', $config);
        $this->session->set('install_step', 3);
        return $response->redirect(url('install/step/3'));
    }

    public function admin(Request $request, Response $response): Response
    {
        $name     = (string) $request->input('admin_name', '');
        $username = (string) $request->input('admin_username', '');
        $email    = (string) $request->input('admin_email', '');
        $password = (string) $request->input('admin_password', '');

        if ($name === '' || $username === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8) {
            $this->session->flash('error', 'Please provide a valid name, username, email and a password of at least 8 characters.');
            return $response->redirect(url('install/step/3'));
        }

        $this->session->set('install_admin', compact('name', 'username', 'email', 'password'));
        $this->session->set('install_step', 4);
        return $response->redirect(url('install/step/4'));
    }

    public function keys(Request $request, Response $response): Response
    {
        try {
            // Generate application secret + RSA key pair.
            $keyDir = (string) config('paths.keys');
            if (!is_dir($keyDir)) {
                mkdir($keyDir, 0700, true);
            }
            if (!is_readable($keyDir . '/app.secret')) {
                file_put_contents($keyDir . '/app.secret', bin2hex(random_bytes(32)));
                @chmod($keyDir . '/app.secret', 0600);
            }

            $crypto = new EncryptionService();
            if (!$crypto->keysExist()) {
                $crypto->generateKeyPair();
            }
        } catch (Throwable $e) {
            $this->session->flash('error', 'Key generation failed: ' . $e->getMessage());
            return $response->redirect(url('install/step/4'));
        }

        $this->session->set('install_step', 5);
        return $response->redirect(url('install/step/5'));
    }

    public function finish(Request $request, Response $response): Response
    {
        $db    = $this->session->get('install_db');
        $admin = $this->session->get('install_admin');

        if (!is_array($db) || !is_array($admin)) {
            $this->session->flash('error', 'Installation session expired. Please restart the wizard.');
            return $response->redirect(url('install'));
        }

        try {
            $pdo = new PDO(
                sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $db['host'], $db['port'], $db['database']),
                $db['username'],
                $db['password'],
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
            );

            // Import schema and seed data.
            $root = (string) config('paths.root');
            $this->runSqlFile($pdo, $root . '/database/database.sql');
            $this->runSqlFile($pdo, $root . '/database/seeds/seed.sql');

            // Create the administrator (super-admin role).
            $roleId = (int) $pdo->query("SELECT id FROM roles WHERE slug = 'super-admin' LIMIT 1")->fetchColumn();
            $hash   = password_hash($admin['password'], config('security.password_algo'), config('security.password_options'));

            $stmt = $pdo->prepare(
                'INSERT INTO users (role_id, name, username, email, password_hash, is_active)
                 VALUES (?, ?, ?, ?, ?, 1)'
            );
            $stmt->execute([$roleId, $admin['name'], $admin['username'], $admin['email'], $hash]);

            // Persist DB credentials.
            $this->writeDatabaseConfig($db);

            // Write install lock.
            file_put_contents($this->lockFile, json_encode([
                'installed_at' => date('c'),
                'version'      => config('app.version'),
            ]));
        } catch (Throwable $e) {
            $this->session->flash('error', 'Installation failed: ' . $e->getMessage());
            return $response->redirect(url('install/step/5'));
        }

        // Clear installer session data.
        foreach (['install_db', 'install_admin', 'install_step'] as $key) {
            $this->session->remove($key);
        }

        $this->session->set('install_step', 6);
        return $response->redirect(url('install/step/6'));
    }

    // ---------------------------------------------------------------

    private function renderStep(Response $response, int $step): Response
    {
        $data = [
            'title'   => 'Installation',
            'step'    => $step,
            'csrf'    => $this->csrf,
            'flashes' => $this->session->getFlashes(),
            'checks'  => $step === 1 ? $this->requirementChecks() : [],
            'db'      => $this->session->get('install_db', []),
        ];

        return $response->body($this->view->render('install/wizard', $data, 'layouts/install'));
    }

    /**
     * @return array<int, array{label:string, ok:bool, detail:string}>
     */
    private function requirementChecks(): array
    {
        $checks   = [];
        $checks[] = ['label' => 'PHP >= 8.3', 'ok' => version_compare(PHP_VERSION, '8.3.0', '>='), 'detail' => PHP_VERSION];
        foreach (['pdo_mysql', 'openssl', 'mbstring', 'json', 'fileinfo'] as $ext) {
            $checks[] = ['label' => "PHP extension: {$ext}", 'ok' => extension_loaded($ext), 'detail' => extension_loaded($ext) ? 'loaded' : 'missing'];
        }
        $writables = [
            'storage'         => config('paths.storage'),
            'storage/logs'    => config('paths.logs'),
            'storage/backups' => config('paths.backups'),
            'config'          => config('paths.root') . '/config',
        ];
        foreach ($writables as $label => $path) {
            $ok       = is_writable((string) $path) || (!file_exists((string) $path) && is_writable(dirname((string) $path)));
            $checks[] = ['label' => "Writable: {$label}", 'ok' => $ok, 'detail' => $ok ? 'writable' : 'not writable'];
        }
        return $checks;
    }

    private function runSqlFile(PDO $pdo, string $file): void
    {
        if (!is_readable($file)) {
            throw new \RuntimeException("SQL file missing: {$file}");
        }
        $sql = (string) file_get_contents($file);
        $pdo->exec($sql);
    }

    /**
     * @param array<string, mixed> $db
     */
    private function writeDatabaseConfig(array $db): void
    {
        $content = "<?php\n\ndeclare(strict_types=1);\n\n"
            . "/**\n * Database credentials written by the PLM installer.\n */\n\n"
            . "return [\n"
            . "    'host'     => " . var_export($db['host'], true) . ",\n"
            . "    'port'     => " . var_export((int) $db['port'], true) . ",\n"
            . "    'database' => " . var_export($db['database'], true) . ",\n"
            . "    'username' => " . var_export($db['username'], true) . ",\n"
            . "    'password' => " . var_export($db['password'], true) . ",\n"
            . "];\n";

        file_put_contents((string) config('paths.root') . '/config/database.local.php', $content);
    }

    private function isInstalled(): bool
    {
        return file_exists($this->lockFile);
    }
}
