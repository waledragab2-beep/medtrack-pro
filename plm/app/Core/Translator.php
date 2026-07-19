<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Lightweight translation manager (i18n).
 *
 * Translations are keyed by their English source string, so views can wrap
 * literals in {@see __()} and untranslated strings fall back gracefully to
 * English. Language files live in /lang/{locale}.php and return a flat
 * array of English => localised string.
 *
 * A static active instance backs the global __() helper so translation works
 * anywhere (controllers, views, partials) without wiring it through every call.
 *
 * @package App\Core
 */
final class Translator
{
    private static ?Translator $active = null;

    private string $locale = 'en';

    /** @var array<string, string> */
    private array $messages = [];

    /** @var array<string, array<string, string>> Loaded locale caches. */
    private array $loaded = [];

    public function __construct(private string $langPath)
    {
    }

    /**
     * Register this instance as the active translator for __().
     */
    public function activate(): void
    {
        self::$active = $this;
    }

    public static function active(): ?Translator
    {
        return self::$active;
    }

    /**
     * Set the current locale, loading its messages.
     */
    public function setLocale(string $locale): void
    {
        $locale = in_array($locale, ['en', 'ar'], true) ? $locale : 'en';
        $this->locale = $locale;

        if (!isset($this->loaded[$locale])) {
            $file = $this->langPath . '/' . $locale . '.php';
            $this->loaded[$locale] = is_readable($file) ? (array) require $file : [];
        }
        $this->messages = $this->loaded[$locale];
    }

    public function locale(): string
    {
        return $this->locale;
    }

    public function isRtl(): bool
    {
        return $this->locale === 'ar';
    }

    public function direction(): string
    {
        return $this->isRtl() ? 'rtl' : 'ltr';
    }

    /**
     * Translate a source string, applying :placeholder replacements.
     *
     * @param array<string, string|int> $replacements
     */
    public function translate(string $text, array $replacements = []): string
    {
        $result = $this->messages[$text] ?? $text;

        foreach ($replacements as $key => $value) {
            $result = str_replace(':' . $key, (string) $value, $result);
        }

        return $result;
    }
}
