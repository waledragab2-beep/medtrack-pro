<?php

declare(strict_types=1);

namespace App\Core;

use Closure;
use ReflectionClass;
use ReflectionNamedType;
use RuntimeException;

/**
 * Minimal dependency-injection container with autowiring.
 *
 * Supports binding of factories/singletons and constructor autowiring via
 * reflection, enabling controllers and services to declare their dependencies.
 *
 * @package App\Core
 */
final class Container
{
    /** @var array<string, Closure> */
    private array $bindings = [];

    /** @var array<string, object> */
    private array $instances = [];

    /**
     * Bind an abstract to a concrete factory.
     */
    public function bind(string $abstract, Closure $factory): void
    {
        $this->bindings[$abstract] = $factory;
    }

    /**
     * Register a shared instance.
     */
    public function instance(string $abstract, object $instance): void
    {
        $this->instances[$abstract] = $instance;
    }

    /**
     * Bind a singleton factory (resolved once).
     */
    public function singleton(string $abstract, Closure $factory): void
    {
        $this->bind($abstract, function (Container $c) use ($abstract, $factory) {
            if (!isset($this->instances[$abstract])) {
                $this->instances[$abstract] = $factory($c);
            }
            return $this->instances[$abstract];
        });
    }

    /**
     * Resolve an abstract to a concrete instance.
     *
     * @template T of object
     * @param class-string<T>|string $abstract
     * @return T|object
     */
    public function make(string $abstract): object
    {
        if (isset($this->instances[$abstract])) {
            return $this->instances[$abstract];
        }

        if (isset($this->bindings[$abstract])) {
            return ($this->bindings[$abstract])($this);
        }

        return $this->build($abstract);
    }

    public function has(string $abstract): bool
    {
        return isset($this->bindings[$abstract]) || isset($this->instances[$abstract]);
    }

    /**
     * Build a class by autowiring its constructor dependencies.
     *
     * @param class-string|string $class
     */
    private function build(string $class): object
    {
        if (!class_exists($class)) {
            throw new RuntimeException("Cannot resolve class: {$class}");
        }

        $reflector   = new ReflectionClass($class);
        $constructor = $reflector->getConstructor();

        if ($constructor === null) {
            return new $class();
        }

        $dependencies = [];
        foreach ($constructor->getParameters() as $param) {
            $type = $param->getType();

            if ($type instanceof ReflectionNamedType && !$type->isBuiltin()) {
                $dependencies[] = $this->make($type->getName());
            } elseif ($param->isDefaultValueAvailable()) {
                $dependencies[] = $param->getDefaultValue();
            } else {
                throw new RuntimeException(
                    "Cannot resolve parameter \${$param->getName()} of {$class}"
                );
            }
        }

        return $reflector->newInstanceArgs($dependencies);
    }
}
