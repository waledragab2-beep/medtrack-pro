<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Base controller providing shared helpers for view rendering,
 * JSON responses, redirects, validation and CSRF handling.
 *
 * @package App\Core
 */
abstract class Controller
{
    public function __construct(
        protected View $view,
        protected Session $session,
        protected Csrf $csrf,
        protected Auth $auth,
        protected Translator $translator
    ) {
    }

    /**
     * Render a full page response.
     *
     * @param array<string, mixed> $data
     */
    protected function render(Response $response, string $view, array $data = [], string $layout = 'layouts/app'): Response
    {
        $this->resolveLocale();
        $data = array_merge($this->viewDefaults(), $data);
        return $response->body($this->view->render($view, $data, $layout));
    }

    /**
     * Resolve and apply the active locale from the current user or settings.
     */
    protected function resolveLocale(): void
    {
        $user   = $this->auth->user();
        $locale = $user['locale'] ?? null;

        if (!is_string($locale) || $locale === '') {
            $locale = (string) config('app.locale', 'en');
        }

        $this->translator->setLocale($locale);
    }

    /**
     * @return array<string, mixed>
     */
    protected function viewDefaults(): array
    {
        return [
            'auth'    => $this->auth,
            'csrf'    => $this->csrf,
            'flashes' => $this->session->getFlashes(),
            'user'    => $this->auth->user(),
        ];
    }

    /**
     * Emit a JSON response.
     *
     * @param mixed $data
     */
    protected function json(Response $response, mixed $data, int $status = 200): Response
    {
        return $response->json($data, $status);
    }

    protected function redirect(Response $response, string $path, int $status = 302): Response
    {
        $base = rtrim((require dirname(__DIR__, 2) . '/config/config.php')['app']['url'], '/');
        $url  = str_starts_with($path, 'http') ? $path : $base . $path;
        return $response->redirect($url, $status);
    }

    protected function back(Response $response, Request $request): Response
    {
        $referer = $request->header('Referer') ?? '/dashboard';
        return $response->redirect($referer);
    }

    /**
     * Validate the CSRF token from the request; abort on failure.
     */
    protected function verifyCsrf(Request $request, Response $response): ?Response
    {
        $token = $request->input('_csrf_token') ?? $request->header('X-CSRF-Token');
        if (!$this->csrf->validate(is_string($token) ? $token : null)) {
            if ($request->wantsJson()) {
                return $response->json(['error' => 'Invalid CSRF token.'], 419);
            }
            $this->session->flash('error', 'Your session expired. Please try again.');
            return $this->back($response, $request);
        }
        return null;
    }

    /**
     * Convenience: validate request data against rules.
     *
     * @param array<string, string> $rules
     * @param array<string, string> $labels
     */
    protected function validate(Request $request, array $rules, array $labels = []): Validator
    {
        return Validator::make($request->all(), $rules, $labels);
    }
}
