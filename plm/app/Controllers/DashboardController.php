<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Translator;
use App\Core\Controller;
use App\Core\Csrf;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Core\View;
use App\Models\ActivationLog;
use App\Models\License;

/**
 * Dashboard: statistics, charts and latest activity.
 *
 * @package App\Controllers
 */
final class DashboardController extends Controller
{
    public function __construct(
        View $view,
        Session $session,
        Csrf $csrf,
        Auth $auth,
        Translator $translator,
        private Database $db,
        private License $licenses,
        private ActivationLog $activationLogs
    ) {
        parent::__construct($view, $session, $csrf, $auth, $translator);
    }

    public function index(Request $request, Response $response): Response
    {
        // Auto-expire overdue licenses on dashboard load.
        $this->licenses->expireOverdue();

        $stats = $this->db->fetch('SELECT * FROM v_dashboard_stats') ?? [];

        $expiring   = $this->licenses->expiringSoon((int) config('license.expiring_window', 30));
        $recentLogs = $this->activationLogs->recent(10);
        $latest     = $this->db->fetchAll(
            "SELECT l.license_number, l.type, l.status, l.created_at, c.company_name, p.name AS product_name
             FROM licenses l JOIN customers c ON c.id = l.customer_id JOIN products p ON p.id = l.product_id
             ORDER BY l.created_at DESC LIMIT 8"
        );

        return $this->render($response, 'dashboard/index', [
            'title'      => 'Dashboard',
            'stats'      => $stats,
            'expiring'   => $expiring,
            'recentLogs' => $recentLogs,
            'latest'     => $latest,
            'active'     => 'dashboard',
        ]);
    }

    public function chartData(Request $request, Response $response): Response
    {
        $revenue = $this->licenses->revenueByMonth(12);
        $byType  = $this->licenses->countByType();
        $byStatus = $this->licenses->countByStatus();
        $activations = $this->activationLogs->activationsByDay(30);

        return $this->json($response, [
            'revenue' => [
                'labels' => array_map(static fn ($r) => $r['ym'], $revenue),
                'data'   => array_map(static fn ($r) => (float) $r['total'], $revenue),
            ],
            'types' => [
                'labels' => array_map(static fn ($r) => ucfirst(str_replace('_', ' ', $r['type'])), $byType),
                'data'   => array_map(static fn ($r) => (int) $r['cnt'], $byType),
            ],
            'status' => [
                'labels' => array_map(static fn ($r) => ucfirst($r['status']), $byStatus),
                'data'   => array_map(static fn ($r) => (int) $r['cnt'], $byStatus),
            ],
            'activations' => [
                'labels' => array_map(static fn ($r) => $r['d'], $activations),
                'data'   => array_map(static fn ($r) => (int) $r['cnt'], $activations),
            ],
        ]);
    }
}
