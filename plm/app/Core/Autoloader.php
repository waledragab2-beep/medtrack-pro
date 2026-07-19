<?php

declare(strict_types=1);

namespace App\Core;

/**
 * PSR-4 compliant autoloader.
 *
 * Provides class autoloading without requiring a Composer `vendor/` build,
 * so the application runs on any standard shared-hosting environment. When
 * Composer's generated autoloader is present it is used transparently; this
 * class is the self-contained fallback.
 *
 * @package App\Core
 */
final class Autoloader
{
    /**
     * Registered namespace prefixes mapped to base directories.
     *
     * @var array<string, string[]>
     */
    private array $prefixes = [];

    /**
     * Register the autoloader with the SPL autoload stack.
     */
    public function register(): void
    {
        spl_autoload_register([$this, 'loadClass']);
    }

    /**
     * Add a base directory for a namespace prefix.
     *
     * @param string $prefix  The namespace prefix (e.g. "App\").
     * @param string $baseDir A base directory for class files in the namespace.
     * @param bool   $prepend If true, prepend the base directory to the stack.
     */
    public function addNamespace(string $prefix, string $baseDir, bool $prepend = false): void
    {
        $prefix  = trim($prefix, '\\') . '\\';
        $baseDir = rtrim($baseDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;

        if (!isset($this->prefixes[$prefix])) {
            $this->prefixes[$prefix] = [];
        }

        if ($prepend) {
            array_unshift($this->prefixes[$prefix], $baseDir);
        } else {
            $this->prefixes[$prefix][] = $baseDir;
        }
    }

    /**
     * Attempt to load the class file for a fully-qualified class name.
     *
     * @param string $class The fully-qualified class name.
     * @return string|false The mapped file path on success, false on failure.
     */
    public function loadClass(string $class): string|false
    {
        $prefix = $class;

        while (false !== $pos = strrpos($prefix, '\\')) {
            $prefix        = substr($class, 0, $pos + 1);
            $relativeClass = substr($class, $pos + 1);

            $mappedFile = $this->loadMappedFile($prefix, $relativeClass);
            if ($mappedFile !== false) {
                return $mappedFile;
            }

            $prefix = rtrim($prefix, '\\');
        }

        return false;
    }

    /**
     * Load the mapped file for a namespace prefix and relative class.
     *
     * @return string|false The file path on success, false otherwise.
     */
    private function loadMappedFile(string $prefix, string $relativeClass): string|false
    {
        if (!isset($this->prefixes[$prefix])) {
            return false;
        }

        foreach ($this->prefixes[$prefix] as $baseDir) {
            $file = $baseDir
                . str_replace('\\', DIRECTORY_SEPARATOR, $relativeClass)
                . '.php';

            if (is_readable($file)) {
                require $file;
                return $file;
            }
        }

        return false;
    }
}
