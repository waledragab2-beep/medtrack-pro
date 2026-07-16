<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Request;
use App\Core\Response;

/**
 * Contract for HTTP middleware.
 *
 * A middleware returns a Response to short-circuit the pipeline, or null to
 * continue to the next middleware / controller.
 *
 * @package App\Middleware
 */
interface MiddlewareInterface
{
    public function handle(Request $request, Response $response): ?Response;
}
