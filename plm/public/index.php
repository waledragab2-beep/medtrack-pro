<?php

declare(strict_types=1);

/**
 * Prima License Manager — Front Controller.
 *
 * All web requests are routed through this single entry point.
 */

/** @var App\Core\App $app */
$app = require dirname(__DIR__) . '/app/Core/bootstrap.php';
$app->run();
