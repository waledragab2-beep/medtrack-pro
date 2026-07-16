<?php

declare(strict_types=1);

namespace App\Core;

use RuntimeException;

/**
 * Lightweight native-PHP view renderer with layout support.
 *
 * Views are plain PHP files. Data is extracted into scope and output is
 * captured. A view may be wrapped in a layout that echoes `$content`.
 *
 * @package App\Core
 */
final class View
{
    /** @var array<string, mixed> */
    private array $shared = [];

    public function __construct(private string $viewPath)
    {
    }

    /**
     * Share a variable with every rendered view.
     */
    public function share(string $key, mixed $value): void
    {
        $this->shared[$key] = $value;
    }

    /**
     * Render a view, optionally wrapped in a layout.
     *
     * @param array<string, mixed> $data
     */
    public function render(string $view, array $data = [], ?string $layout = 'layouts/app'): string
    {
        $content = $this->renderPartial($view, $data);

        if ($layout !== null) {
            $data['content'] = $content;
            return $this->renderPartial($layout, $data);
        }

        return $content;
    }

    /**
     * Render a view file and return its output.
     *
     * @param array<string, mixed> $data
     */
    public function renderPartial(string $view, array $data = []): string
    {
        $file = $this->viewPath . '/' . str_replace('.', '/', $view) . '.php';

        if (!is_readable($file)) {
            throw new RuntimeException("View not found: {$view} ({$file})");
        }

        $data = array_merge($this->shared, $data);
        extract($data, EXTR_SKIP);

        ob_start();
        include $file;
        return (string) ob_get_clean();
    }
}
