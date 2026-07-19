<?php

declare(strict_types=1);

namespace App\Core;

use App\Middleware\MiddlewareInterface;

/**
 * HTTP router with named parameters and per-route middleware.
 *
 * Routes are registered with a method, a path pattern (supporting `{param}`
 * placeholders), a handler `[ControllerClass, method]`, and an optional list
 * of middleware class names.
 *
 * @package App\Core
 */
final class Router
{
    /** @var array<int, array{method:string, pattern:string, regex:string, params:string[], handler:array{0:class-string,1:string}, middleware:string[]}> */
    private array $routes = [];

    public function __construct(private Container $container)
    {
    }

    /**
     * @param array{0:class-string,1:string} $handler
     * @param string[] $middleware
     */
    public function add(string $method, string $path, array $handler, array $middleware = []): void
    {
        $path   = '/' . trim($path, '/');
        $params = [];

        $regex = preg_replace_callback('/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/', static function ($m) use (&$params) {
            $params[] = $m[1];
            return '(?P<' . $m[1] . '>[^/]+)';
        }, $path);

        $this->routes[] = [
            'method'     => strtoupper($method),
            'pattern'    => $path,
            'regex'      => '#^' . $regex . '$#',
            'params'     => $params,
            'handler'    => $handler,
            'middleware' => $middleware,
        ];
    }

    /**
     * @param array{0:class-string,1:string} $handler
     * @param string[] $middleware
     */
    public function get(string $path, array $handler, array $middleware = []): void
    {
        $this->add('GET', $path, $handler, $middleware);
    }

    /**
     * @param array{0:class-string,1:string} $handler
     * @param string[] $middleware
     */
    public function post(string $path, array $handler, array $middleware = []): void
    {
        $this->add('POST', $path, $handler, $middleware);
    }

    /**
     * @param array{0:class-string,1:string} $handler
     * @param string[] $middleware
     */
    public function any(string $path, array $handler, array $middleware = []): void
    {
        foreach (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as $m) {
            $this->add($m, $path, $handler, $middleware);
        }
    }

    /**
     * Dispatch the request to a matching route.
     */
    public function dispatch(Request $request, Response $response): Response
    {
        $method = $request->method();
        $uri    = $request->uri();

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }

            if (!preg_match($route['regex'], $uri, $matches)) {
                continue;
            }

            $params = [];
            foreach ($route['params'] as $name) {
                $params[$name] = $matches[$name] ?? '';
            }
            $request->setRouteParams($params);

            // Run middleware chain.
            foreach ($route['middleware'] as $middlewareClass) {
                /** @var MiddlewareInterface $middleware */
                $middleware = $this->container->make($middlewareClass);
                $result = $middleware->handle($request, $response);
                if ($result instanceof Response) {
                    return $result;
                }
            }

            [$controllerClass, $action] = $route['handler'];
            $controller = $this->container->make($controllerClass);

            /** @var Response $result */
            $result = $controller->{$action}($request, $response);
            return $result instanceof Response ? $result : $response;
        }

        return $this->notFound($request, $response);
    }

    private function notFound(Request $request, Response $response): Response
    {
        if ($request->wantsJson()) {
            return $response->json(['error' => 'Not Found', 'status' => 404], 404);
        }

        $view = $this->container->make(View::class);
        return $response->status(404)->body($view->render('errors/404', [], 'layouts/blank'));
    }
}
