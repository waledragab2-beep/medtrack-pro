<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Rule-based input validator.
 *
 * Rules are declared as `field => 'rule1|rule2:param'`. Supported rules:
 * required, email, numeric, integer, min:n, max:n, minlen:n, maxlen:n,
 * in:a,b,c, date, url, alpha, alphanum, confirmed, unique (checked externally),
 * regex:pattern, boolean.
 *
 * @package App\Core
 */
final class Validator
{
    /** @var array<string, string[]> */
    private array $errors = [];

    /**
     * @param array<string, mixed> $data
     * @param array<string, string> $rules
     * @param array<string, string> $labels
     */
    public function __construct(
        private array $data,
        private array $rules,
        private array $labels = []
    ) {
    }

    /**
     * @param array<string, mixed> $data
     * @param array<string, string> $rules
     * @param array<string, string> $labels
     */
    public static function make(array $data, array $rules, array $labels = []): self
    {
        $v = new self($data, $rules, $labels);
        $v->validate();
        return $v;
    }

    public function validate(): bool
    {
        foreach ($this->rules as $field => $ruleString) {
            $rules = explode('|', $ruleString);
            $value = $this->data[$field] ?? null;

            foreach ($rules as $rule) {
                [$name, $param] = array_pad(explode(':', $rule, 2), 2, null);
                $this->applyRule($field, $value, $name, $param);
            }
        }

        return $this->passes();
    }

    private function applyRule(string $field, mixed $value, string $rule, ?string $param): void
    {
        $label  = $this->labels[$field] ?? ucfirst(str_replace('_', ' ', $field));
        $filled = $value !== null && $value !== '' && $value !== [];

        switch ($rule) {
            case 'required':
                if (!$filled) {
                    $this->addError($field, "{$label} is required.");
                }
                break;

            case 'email':
                if ($filled && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                    $this->addError($field, "{$label} must be a valid email address.");
                }
                break;

            case 'numeric':
                if ($filled && !is_numeric($value)) {
                    $this->addError($field, "{$label} must be numeric.");
                }
                break;

            case 'integer':
                if ($filled && filter_var($value, FILTER_VALIDATE_INT) === false) {
                    $this->addError($field, "{$label} must be an integer.");
                }
                break;

            case 'boolean':
                if ($filled && !in_array((string) $value, ['0', '1', 'true', 'false', 'on', 'off'], true)) {
                    $this->addError($field, "{$label} must be boolean.");
                }
                break;

            case 'min':
                if ($filled && (float) $value < (float) $param) {
                    $this->addError($field, "{$label} must be at least {$param}.");
                }
                break;

            case 'max':
                if ($filled && (float) $value > (float) $param) {
                    $this->addError($field, "{$label} must not exceed {$param}.");
                }
                break;

            case 'minlen':
                if ($filled && mb_strlen((string) $value) < (int) $param) {
                    $this->addError($field, "{$label} must be at least {$param} characters.");
                }
                break;

            case 'maxlen':
                if ($filled && mb_strlen((string) $value) > (int) $param) {
                    $this->addError($field, "{$label} must not exceed {$param} characters.");
                }
                break;

            case 'in':
                $options = explode(',', (string) $param);
                if ($filled && !in_array((string) $value, $options, true)) {
                    $this->addError($field, "{$label} is invalid.");
                }
                break;

            case 'date':
                if ($filled && strtotime((string) $value) === false) {
                    $this->addError($field, "{$label} must be a valid date.");
                }
                break;

            case 'url':
                if ($filled && !filter_var($value, FILTER_VALIDATE_URL)) {
                    $this->addError($field, "{$label} must be a valid URL.");
                }
                break;

            case 'alpha':
                if ($filled && !ctype_alpha(str_replace(' ', '', (string) $value))) {
                    $this->addError($field, "{$label} may only contain letters.");
                }
                break;

            case 'alphanum':
                if ($filled && !preg_match('/^[a-zA-Z0-9_\- ]+$/', (string) $value)) {
                    $this->addError($field, "{$label} may only contain letters, numbers, and dashes.");
                }
                break;

            case 'confirmed':
                if ($value !== ($this->data[$field . '_confirmation'] ?? null)) {
                    $this->addError($field, "{$label} confirmation does not match.");
                }
                break;

            case 'regex':
                if ($filled && $param !== null && !preg_match($param, (string) $value)) {
                    $this->addError($field, "{$label} format is invalid.");
                }
                break;
        }
    }

    public function addError(string $field, string $message): void
    {
        $this->errors[$field][] = $message;
    }

    public function passes(): bool
    {
        return $this->errors === [];
    }

    public function fails(): bool
    {
        return !$this->passes();
    }

    /**
     * @return array<string, string[]>
     */
    public function errors(): array
    {
        return $this->errors;
    }

    /**
     * @return string[]
     */
    public function flatErrors(): array
    {
        $flat = [];
        foreach ($this->errors as $messages) {
            foreach ($messages as $message) {
                $flat[] = $message;
            }
        }
        return $flat;
    }

    public function first(): ?string
    {
        $flat = $this->flatErrors();
        return $flat[0] ?? null;
    }
}
