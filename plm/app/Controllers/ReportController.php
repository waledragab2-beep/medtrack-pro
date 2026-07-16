<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Controller;
use App\Core\Csrf;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Core\View;
use App\Services\ExportService;

/**
 * Reporting module: renders and exports the various operational reports.
 *
 * @package App\Controllers
 */
final class ReportController extends Controller
{
    /** @var array<string, array{title:string, headers:string[]}> */
    private const REPORTS = [
        'customers'   => ['title' => 'Customer Report',   'headers' => ['ID', 'Company', 'Contact', 'Email', 'Country', 'Status', 'Licenses']],
        'products'    => ['title' => 'Product Report',    'headers' => ['ID', 'Name', 'Code', 'Category', 'Versions', 'Licenses', 'Status']],
        'licenses'    => ['title' => 'License Report',    'headers' => ['Number', 'Customer', 'Product', 'Type', 'Issue', 'Expire', 'Status', 'Price']],
        'renewals'    => ['title' => 'Renewal Report',    'headers' => ['Number', 'Customer', 'Product', 'Expire', 'Days Left', 'Price']],
        'expired'     => ['title' => 'Expired Report',    'headers' => ['Number', 'Customer', 'Product', 'Type', 'Expired On']],
        'activations' => ['title' => 'Activation Report', 'headers' => ['Date', 'License', 'Action', 'Result', 'IP', 'Message']],
        'revenue'     => ['title' => 'Revenue Report',    'headers' => ['Month', 'Licenses', 'Revenue']],
    ];

    public function __construct(
        View $view,
        Session $session,
        Csrf $csrf,
        Auth $auth,
        private Database $db,
        private ExportService $export
    ) {
        parent::__construct($view, $session, $csrf, $auth);
    }

    public function index(Request $request, Response $response): Response
    {
        return $this->render($response, 'reports/index', [
            'title'   => 'Reports',
            'reports' => self::REPORTS,
            'active'  => 'reports',
        ]);
    }

    public function show(Request $request, Response $response): Response
    {
        $type = (string) $request->route('type');
        if (!isset(self::REPORTS[$type])) {
            return $this->notFound($response);
        }

        [$headers, $rows] = $this->buildReport($type);

        return $this->render($response, 'reports/show', [
            'title'   => self::REPORTS[$type]['title'],
            'type'    => $type,
            'headers' => $headers,
            'rows'    => $rows,
            'active'  => 'reports',
        ]);
    }

    public function export(Request $request, Response $response): Response
    {
        $type   = (string) $request->route('type');
        $format = (string) $request->route('format');
        if (!isset(self::REPORTS[$type])) {
            return $this->notFound($response);
        }

        [$headers, $rows] = $this->buildReport($type);
        $title = self::REPORTS[$type]['title'];
        $stamp = date('Ymd-His');

        return match ($format) {
            'csv'   => $response->attachment(
                $this->export->toCsv($headers, $rows),
                "{$type}-{$stamp}.csv",
                'text/csv; charset=utf-8'
            ),
            'excel' => $response->attachment(
                $this->export->toExcel($headers, $rows, $title),
                "{$type}-{$stamp}.xls",
                'application/vnd.ms-excel'
            ),
            'pdf', 'print' => $response
                ->header('Content-Type', 'text/html; charset=utf-8')
                ->body($this->export->toPrintableHtml($title, $headers, $rows, (string) config('app.name'))),
            default => $this->notFound($response),
        };
    }

    /**
     * @return array{0: string[], 1: array<int, array<int, mixed>>}
     */
    private function buildReport(string $type): array
    {
        $headers = self::REPORTS[$type]['headers'];
        $rows    = [];

        switch ($type) {
            case 'customers':
                $data = $this->db->fetchAll(
                    'SELECT c.id, c.company_name, c.contact_person, c.email, c.country, c.status,
                            (SELECT COUNT(*) FROM licenses l WHERE l.customer_id = c.id) AS lic
                     FROM customers c ORDER BY c.company_name'
                );
                foreach ($data as $r) {
                    $rows[] = [$r['id'], $r['company_name'], $r['contact_person'], $r['email'], $r['country'], $r['status'], $r['lic']];
                }
                break;

            case 'products':
                $data = $this->db->fetchAll(
                    'SELECT p.id, p.name, p.code, p.category, p.status,
                            (SELECT COUNT(*) FROM software_versions v WHERE v.product_id = p.id) AS vers,
                            (SELECT COUNT(*) FROM licenses l WHERE l.product_id = p.id) AS lic
                     FROM products p ORDER BY p.name'
                );
                foreach ($data as $r) {
                    $rows[] = [$r['id'], $r['name'], $r['code'], $r['category'], $r['vers'], $r['lic'], $r['status']];
                }
                break;

            case 'licenses':
                $data = $this->db->fetchAll(
                    'SELECT l.license_number, c.company_name, p.name AS product, l.type, l.issue_date,
                            l.expire_date, l.status, l.price, l.currency
                     FROM licenses l JOIN customers c ON c.id = l.customer_id JOIN products p ON p.id = l.product_id
                     ORDER BY l.created_at DESC'
                );
                foreach ($data as $r) {
                    $rows[] = [$r['license_number'], $r['company_name'], $r['product'], ucfirst(str_replace('_', ' ', $r['type'])),
                        $r['issue_date'], $r['expire_date'] ?? 'Lifetime', $r['status'], $r['currency'] . ' ' . $r['price']];
                }
                break;

            case 'renewals':
                $data = $this->db->fetchAll(
                    "SELECT l.license_number, c.company_name, p.name AS product, l.expire_date, l.price, l.currency,
                            DATEDIFF(l.expire_date, CURDATE()) AS days
                     FROM licenses l JOIN customers c ON c.id = l.customer_id JOIN products p ON p.id = l.product_id
                     WHERE l.status = 'active' AND l.type <> 'lifetime' AND l.expire_date IS NOT NULL
                       AND l.expire_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
                     ORDER BY l.expire_date ASC"
                );
                foreach ($data as $r) {
                    $rows[] = [$r['license_number'], $r['company_name'], $r['product'], $r['expire_date'], $r['days'], $r['currency'] . ' ' . $r['price']];
                }
                break;

            case 'expired':
                $data = $this->db->fetchAll(
                    "SELECT l.license_number, c.company_name, p.name AS product, l.type, l.expire_date
                     FROM licenses l JOIN customers c ON c.id = l.customer_id JOIN products p ON p.id = l.product_id
                     WHERE l.status = 'expired' ORDER BY l.expire_date DESC"
                );
                foreach ($data as $r) {
                    $rows[] = [$r['license_number'], $r['company_name'], $r['product'], ucfirst(str_replace('_', ' ', $r['type'])), $r['expire_date']];
                }
                break;

            case 'activations':
                $data = $this->db->fetchAll(
                    'SELECT al.created_at, l.license_number, al.action, al.result, al.ip_address, al.message
                     FROM activation_logs al LEFT JOIN licenses l ON l.id = al.license_id
                     ORDER BY al.created_at DESC LIMIT 1000'
                );
                foreach ($data as $r) {
                    $rows[] = [$r['created_at'], $r['license_number'] ?? '—', $r['action'], $r['result'], $r['ip_address'], $r['message']];
                }
                break;

            case 'revenue':
                $data = $this->db->fetchAll(
                    "SELECT DATE_FORMAT(issue_date, '%Y-%m') AS ym, COUNT(*) AS cnt, SUM(price) AS total
                     FROM licenses GROUP BY ym ORDER BY ym DESC"
                );
                foreach ($data as $r) {
                    $rows[] = [$r['ym'], $r['cnt'], number_format((float) $r['total'], 2)];
                }
                break;
        }

        return [$headers, $rows];
    }

    private function notFound(Response $response): Response
    {
        return $response->status(404)->body(
            $this->view->render('errors/404', $this->viewDefaults(), 'layouts/app')
        );
    }
}
