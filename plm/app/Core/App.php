<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Application kernel: bootstraps configuration, the DI container, core
 * services and the router, then dispatches the request.
 *
 * @package App\Core
 */
final class App
{
    private Container $container;

    /** @var array<string, mixed> */
    private array $config;

    public function __construct()
    {
        $this->config = require dirname(__DIR__, 2) . '/config/config.php';
        date_default_timezone_set($this->config['app']['timezone'] ?? 'UTC');

        $this->configureErrorHandling();
        $this->container = new Container();
        $this->registerCore();
    }

    private function configureErrorHandling(): void
    {
        $debug = $this->config['app']['debug'] ?? false;
        error_reporting(E_ALL);
        ini_set('display_errors', $debug ? '1' : '0');
        ini_set('log_errors', '1');
        ini_set('error_log', $this->config['paths']['logs'] . '/php-error.log');
    }

    private function registerCore(): void
    {
        $c = $this->container;

        $c->instance(Container::class, $c);

        $c->singleton(Logger::class, fn () => new Logger($this->config['paths']['logs']));
        $c->singleton(Session::class, fn () => new Session($this->config['security']));
        $c->singleton(Translator::class, function () {
            $translator = new Translator(dirname(__DIR__, 2) . '/lang');
            $translator->setLocale($this->config['app']['locale'] ?? 'en');
            $translator->activate();
            return $translator;
        });
        $c->singleton(Request::class, fn () => new Request());
        $c->singleton(Response::class, fn () => new Response());
        $c->singleton(View::class, fn () => new View($this->config['paths']['views']));
        $c->singleton(Csrf::class, fn (Container $c) => new Csrf($c->make(Session::class)));

        // Database (only when installed).
        $c->singleton(Database::class, fn () => Database::instance());

        // Auth needs models.
        $c->singleton(Auth::class, fn (Container $c) => new Auth(
            $c->make(Session::class),
            $c->make(\App\Models\User::class),
            $c->make(\App\Models\Permission::class)
        ));
    }

    public function container(): Container
    {
        return $this->container;
    }

    /**
     * Run the HTTP application.
     */
    public function run(): void
    {
        $session  = $this->container->make(Session::class);
        $session->start();

        // Activate the translator (locale is refined per-request by controllers).
        $this->container->make(Translator::class);

        $request  = $this->container->make(Request::class);
        $response = $this->container->make(Response::class);

        // Redirect to installer if not yet installed.
        if (!($this->config['app']['installed'] ?? false) && !str_starts_with($request->uri(), '/install')) {
            $base = rtrim((string) ($this->config['app']['url'] ?? ''), '/');
            if ($base === '') {
                $base = $request->basePath();   // subdirectory-aware fallback (e.g. "/license")
            }
            $response->redirect($base . '/install')->send();
            return;
        }

        $router = new Router($this->container);
        $this->loadRoutes($router);

        try {
            $result = $router->dispatch($request, $response);
            $result->send();
        } catch (\Throwable $e) {
            $this->handleException($e, $request, $response);
        }
    }

    private function loadRoutes(Router $router): void
    {
        $register = require dirname(__DIR__, 2) . '/routes/web.php';
        $register($router);

        $apiRegister = require dirname(__DIR__, 2) . '/routes/api.php';
        $apiRegister($router);
    }

    private function handleException(\Throwable $e, Request $request, Response $response): void
    {
        $logger = $this->container->make(Logger::class);
        $logger->error($e->getMessage(), [
            'file'  => $e->getFile(),
            'line'  => $e->getLine(),
            'trace' => $e->getTraceAsString(),
        ]);

        $debug = $this->config['app']['debug'] ?? false;

        if ($request->wantsJson()) {
            $payload = ['error' => 'Server Error'];
            if ($debug) {
                $payload['message'] = $e->getMessage();
                $payload['file']    = $e->getFile() . ':' . $e->getLine();
            }
            $response->json($payload, 500)->send();
            return;
        }

        $view = $this->container->make(View::class);
        $html = $view->render('errors/500', [
            'message' => $debug ? $e->getMessage() : null,
            'trace'   => $debug ? $e->getTraceAsString() : null,
        ], 'layouts/blank');
        $response->status(500)->body($html)->send();
    }
}
