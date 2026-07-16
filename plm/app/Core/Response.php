<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Encapsulates the outgoing HTTP response.
 *
 * @package App\Core
 */
final class Response
{
    private int $status = 200;

    /** @var array<string, string> */
    private array $headers = [];

    private string $body = '';

    public function status(int $code): self
    {
        $this->status = $code;
        return $this;
    }

    public function header(string $name, string $value): self
    {
        $this->headers[$name] = $value;
        return $this;
    }

    public function body(string $content): self
    {
        $this->body = $content;
        return $this;
    }

    /**
     * Build a JSON response.
     *
     * @param mixed $data
     */
    public function json(mixed $data, int $status = 200): self
    {
        $this->status = $status;
        $this->headers['Content-Type'] = 'application/json; charset=utf-8';
        $this->body = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
        return $this;
    }

    /**
     * Build a redirect response.
     */
    public function redirect(string $url, int $status = 302): self
    {
        $this->status = $status;
        $this->headers['Location'] = $url;
        return $this;
    }

    /**
     * Trigger a file download.
     */
    public function download(string $path, string $filename, string $mime = 'application/octet-stream'): self
    {
        $this->headers['Content-Type']        = $mime;
        $this->headers['Content-Disposition'] = 'attachment; filename="' . $filename . '"';
        $this->headers['Content-Length']      = (string) filesize($path);
        $this->body = (string) file_get_contents($path);
        return $this;
    }

    /**
     * Send raw binary content as a download.
     */
    public function attachment(string $content, string $filename, string $mime = 'application/octet-stream'): self
    {
        $this->headers['Content-Type']        = $mime;
        $this->headers['Content-Disposition'] = 'attachment; filename="' . $filename . '"';
        $this->headers['Content-Length']      = (string) strlen($content);
        $this->body = $content;
        return $this;
    }

    /**
     * Emit the response to the client.
     */
    public function send(): void
    {
        if (!headers_sent()) {
            http_response_code($this->status);
            foreach ($this->headers as $name => $value) {
                header($name . ': ' . $value);
            }
        }
        echo $this->body;
    }
}
