<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Logger;
use App\Models\Setting;

/**
 * Lightweight SMTP mail service.
 *
 * Implements a minimal SMTP client over raw sockets (with STARTTLS / SSL
 * support) so no external dependency is required on shared hosting. Falls
 * back to PHP's mail() when SMTP is not configured.
 *
 * @package App\Services
 */
final class MailService
{
    public function __construct(private Setting $settings, private Logger $logger)
    {
    }

    /**
     * Send an email. Returns true on success.
     */
    public function send(string $to, string $subject, string $htmlBody): bool
    {
        $host = (string) $this->settings->get('smtp_host', '');

        if ($host === '') {
            return $this->sendWithMailFunction($to, $subject, $htmlBody);
        }

        try {
            return $this->sendSmtp($to, $subject, $htmlBody);
        } catch (\Throwable $e) {
            $this->logger->error('SMTP send failed: ' . $e->getMessage(), ['to' => $to]);
            return false;
        }
    }

    private function fromEmail(): string
    {
        return (string) ($this->settings->get('smtp_from_email') ?: $this->settings->get('company_email', 'no-reply@localhost'));
    }

    private function fromName(): string
    {
        return (string) $this->settings->get('smtp_from_name', 'Prima License Manager');
    }

    private function sendWithMailFunction(string $to, string $subject, string $htmlBody): bool
    {
        $headers = implode("\r\n", [
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'From: ' . $this->fromName() . ' <' . $this->fromEmail() . '>',
        ]);

        return @mail($to, $subject, $htmlBody, $headers);
    }

    private function sendSmtp(string $to, string $subject, string $htmlBody): bool
    {
        $host       = (string) $this->settings->get('smtp_host');
        $port       = (int) $this->settings->get('smtp_port', 587);
        $user       = (string) $this->settings->get('smtp_user');
        $pass       = (string) $this->settings->get('smtp_password');
        $encryption = (string) $this->settings->get('smtp_encryption', 'tls');

        $transport = $encryption === 'ssl' ? 'ssl://' : '';
        $socket    = @fsockopen($transport . $host, $port, $errno, $errstr, 15);

        if ($socket === false) {
            throw new \RuntimeException("SMTP connect failed: {$errstr} ({$errno})");
        }

        $this->expect($socket, '220');
        $this->command($socket, 'EHLO ' . ($this->fromEmail() ? explode('@', $this->fromEmail())[1] : 'localhost'), '250');

        if ($encryption === 'tls') {
            $this->command($socket, 'STARTTLS', '220');
            stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            $this->command($socket, 'EHLO localhost', '250');
        }

        if ($user !== '') {
            $this->command($socket, 'AUTH LOGIN', '334');
            $this->command($socket, base64_encode($user), '334');
            $this->command($socket, base64_encode($pass), '235');
        }

        $this->command($socket, 'MAIL FROM:<' . $this->fromEmail() . '>', '250');
        $this->command($socket, 'RCPT TO:<' . $to . '>', '250');
        $this->command($socket, 'DATA', '354');

        $message = $this->buildMessage($to, $subject, $htmlBody);
        fwrite($socket, $message . "\r\n.\r\n");
        $this->expect($socket, '250');

        $this->command($socket, 'QUIT', '221');
        fclose($socket);

        return true;
    }

    private function buildMessage(string $to, string $subject, string $body): string
    {
        return implode("\r\n", [
            'Date: ' . date('r'),
            'From: ' . $this->fromName() . ' <' . $this->fromEmail() . '>',
            'To: <' . $to . '>',
            'Subject: ' . $this->encodeHeader($subject),
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            '',
            chunk_split(base64_encode($body)),
        ]);
    }

    private function encodeHeader(string $text): string
    {
        return '=?UTF-8?B?' . base64_encode($text) . '?=';
    }

    /**
     * @param resource $socket
     */
    private function command($socket, string $command, string $expectedCode): void
    {
        fwrite($socket, $command . "\r\n");
        $this->expect($socket, $expectedCode);
    }

    /**
     * @param resource $socket
     */
    private function expect($socket, string $code): void
    {
        $response = '';
        while (($line = fgets($socket, 515)) !== false) {
            $response .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        if (!str_starts_with($response, $code)) {
            throw new \RuntimeException("SMTP error: expected {$code}, got: " . trim($response));
        }
    }
}
