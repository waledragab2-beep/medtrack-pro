<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Tabular export service producing CSV, Excel (SpreadsheetML) and printable
 * HTML / PDF-ready documents without external dependencies.
 *
 * @package App\Services
 */
final class ExportService
{
    /**
     * Build a CSV string from headers and rows.
     *
     * @param string[] $headers
     * @param array<int, array<int, mixed>> $rows
     */
    public function toCsv(array $headers, array $rows): string
    {
        $handle = fopen('php://temp', 'r+');
        fputcsv($handle, $headers);
        foreach ($rows as $row) {
            fputcsv($handle, $row);
        }
        rewind($handle);
        $csv = (string) stream_get_contents($handle);
        fclose($handle);

        // Prepend BOM for Excel UTF-8 compatibility.
        return "\xEF\xBB\xBF" . $csv;
    }

    /**
     * Build a SpreadsheetML (.xls) document readable by Excel.
     *
     * @param string[] $headers
     * @param array<int, array<int, mixed>> $rows
     */
    public function toExcel(array $headers, array $rows, string $title = 'Report'): string
    {
        $xml  = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<?mso-application progid="Excel.Sheet"?>' . "\n";
        $xml .= '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" '
              . 'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' . "\n";
        $xml .= '<Styles><Style ss:ID="hdr"><Font ss:Bold="1"/>'
              . '<Interior ss:Color="#1a3a5c" ss:Pattern="Solid"/>'
              . '<Font ss:Color="#FFFFFF" ss:Bold="1"/></Style></Styles>' . "\n";
        $xml .= '<Worksheet ss:Name="' . $this->xmlEscape($title) . '"><Table>' . "\n";

        $xml .= '<Row>';
        foreach ($headers as $header) {
            $xml .= '<Cell ss:StyleID="hdr"><Data ss:Type="String">' . $this->xmlEscape((string) $header) . '</Data></Cell>';
        }
        $xml .= '</Row>' . "\n";

        foreach ($rows as $row) {
            $xml .= '<Row>';
            foreach ($row as $cell) {
                $type = is_numeric($cell) ? 'Number' : 'String';
                $xml .= '<Cell><Data ss:Type="' . $type . '">' . $this->xmlEscape((string) $cell) . '</Data></Cell>';
            }
            $xml .= '</Row>' . "\n";
        }

        $xml .= '</Table></Worksheet></Workbook>';
        return $xml;
    }

    /**
     * Build a self-contained printable HTML document that browsers can
     * "Print → Save as PDF". Includes company header and table styling.
     *
     * @param string[] $headers
     * @param array<int, array<int, mixed>> $rows
     */
    public function toPrintableHtml(string $title, array $headers, array $rows, string $company = 'Prima Software'): string
    {
        $thead = '';
        foreach ($headers as $header) {
            $thead .= '<th>' . htmlspecialchars((string) $header, ENT_QUOTES) . '</th>';
        }

        $tbody = '';
        foreach ($rows as $row) {
            $tbody .= '<tr>';
            foreach ($row as $cell) {
                $tbody .= '<td>' . htmlspecialchars((string) $cell, ENT_QUOTES) . '</td>';
            }
            $tbody .= '</tr>';
        }

        $generated = date('Y-m-d H:i');
        $safeTitle = htmlspecialchars($title, ENT_QUOTES);
        $safeCo    = htmlspecialchars($company, ENT_QUOTES);

        return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{$safeTitle}</title>
<style>
    * { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
    body { margin: 30px; color: #222; }
    .header { display:flex; justify-content:space-between; align-items:center;
              border-bottom: 3px solid #1a3a5c; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { color:#1a3a5c; font-size: 22px; margin:0; }
    .header .meta { text-align:right; font-size: 12px; color:#666; }
    table { width:100%; border-collapse: collapse; font-size: 12px; }
    th { background:#1a3a5c; color:#fff; text-align:left; padding: 8px; }
    td { padding: 7px 8px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) td { background:#f7f9fb; }
    .footer { margin-top: 20px; font-size: 11px; color:#999; text-align:center; }
    @media print { body { margin: 12mm; } .no-print { display:none; } }
</style>
</head>
<body>
<div class="header">
    <div><h1>{$safeTitle}</h1><div style="font-size:13px;color:#555;">{$safeCo}</div></div>
    <div class="meta">Generated: {$generated}<br>Prima License Manager</div>
</div>
<button class="no-print" onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;background:#1a3a5c;color:#fff;border:0;border-radius:6px;cursor:pointer;">Print / Save PDF</button>
<table>
<thead><tr>{$thead}</tr></thead>
<tbody>{$tbody}</tbody>
</table>
<div class="footer">&copy; {$generated} {$safeCo} — Prima License Manager</div>
</body>
</html>
HTML;
    }

    private function xmlEscape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_XML1, 'UTF-8');
    }
}
