<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Auth;
use App\Core\Request;
use App\Models\AuditLog;

/**
 * Records audit-trail entries for user actions.
 *
 * @package App\Services
 */
final class AuditService
{
    public function __construct(
        private AuditLog $auditLog,
        private Auth $auth,
        private Request $request
    ) {
    }

    /**
     * Log an action.
     *
     * @param array<string, mixed>|null $old
     * @param array<string, mixed>|null $new
     */
    public function log(
        string $action,
        string $description,
        ?string $entity = null,
        ?int $entityId = null,
        ?array $old = null,
        ?array $new = null
    ): void {
        $this->auditLog->create([
            'user_id'     => $this->auth->id(),
            'action'      => $action,
            'entity'      => $entity,
            'entity_id'   => $entityId,
            'description' => mb_substr($description, 0, 255),
            'old_values'  => $old !== null ? json_encode($old, JSON_UNESCAPED_UNICODE) : null,
            'new_values'  => $new !== null ? json_encode($new, JSON_UNESCAPED_UNICODE) : null,
            'ip_address'  => $this->request->ip(),
            'user_agent'  => mb_substr($this->request->userAgent(), 0, 255),
        ]);
    }
}
