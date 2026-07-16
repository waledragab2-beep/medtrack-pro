<?php

declare(strict_types=1);

namespace App\Services;

use RuntimeException;

/**
 * Cryptography service.
 *
 * Provides AES-256-CBC symmetric encryption, RSA-4096 key generation, digital
 * signing (SHA-256) and verification, and secure hashing. Keys are stored on
 * disk under storage/keys with restrictive permissions.
 *
 * @package App\Services
 */
final class EncryptionService
{
    private string $cipher;

    private string $keyDir;

    public function __construct()
    {
        $this->cipher = (string) config('license.cipher', 'aes-256-cbc');
        $this->keyDir = (string) config('paths.keys');
        if (!is_dir($this->keyDir)) {
            @mkdir($this->keyDir, 0700, true);
        }
    }

    /**
     * Derive a 32-byte key from the application secret.
     */
    private function symmetricKey(): string
    {
        $secretFile = $this->keyDir . '/app.secret';
        if (!is_readable($secretFile)) {
            throw new RuntimeException('Application secret is missing. Run the installer.');
        }
        $secret = (string) file_get_contents($secretFile);
        return hash('sha256', $secret, true);
    }

    /**
     * AES-256-CBC encrypt data, returning base64(iv|ciphertext|hmac).
     */
    public function encrypt(string $plaintext): string
    {
        $key    = $this->symmetricKey();
        $ivLen  = openssl_cipher_iv_length($this->cipher) ?: 16;
        $iv     = random_bytes($ivLen);
        $cipher = openssl_encrypt($plaintext, $this->cipher, $key, OPENSSL_RAW_DATA, $iv);

        if ($cipher === false) {
            throw new RuntimeException('Encryption failed.');
        }

        $hmac = hash_hmac('sha256', $iv . $cipher, $key, true);
        return base64_encode($iv . $cipher . $hmac);
    }

    /**
     * AES-256-CBC decrypt data produced by {@see encrypt()}.
     */
    public function decrypt(string $payload): string
    {
        $key  = $this->symmetricKey();
        $data = base64_decode($payload, true);
        if ($data === false) {
            throw new RuntimeException('Invalid ciphertext encoding.');
        }

        $ivLen  = openssl_cipher_iv_length($this->cipher) ?: 16;
        $iv     = substr($data, 0, $ivLen);
        $hmac   = substr($data, -32);
        $cipher = substr($data, $ivLen, -32);

        $expected = hash_hmac('sha256', $iv . $cipher, $key, true);
        if (!hash_equals($expected, $hmac)) {
            throw new RuntimeException('Integrity check failed (tampered data).');
        }

        $plain = openssl_decrypt($cipher, $this->cipher, $key, OPENSSL_RAW_DATA, $iv);
        if ($plain === false) {
            throw new RuntimeException('Decryption failed.');
        }

        return $plain;
    }

    /**
     * Generate an RSA-4096 key pair and persist it.
     *
     * @return array{private: string, public: string}
     */
    public function generateKeyPair(): array
    {
        $config = [
            'private_key_bits' => (int) config('license.rsa_bits', 4096),
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
            'digest_alg'       => 'sha256',
        ];

        $res = openssl_pkey_new($config);
        if ($res === false) {
            throw new RuntimeException('RSA key generation failed: ' . openssl_error_string());
        }

        openssl_pkey_export($res, $privateKey);
        $details   = openssl_pkey_get_details($res);
        $publicKey = $details['key'] ?? '';

        file_put_contents($this->keyDir . '/private.pem', $privateKey);
        file_put_contents($this->keyDir . '/public.pem', $publicKey);
        @chmod($this->keyDir . '/private.pem', 0600);
        @chmod($this->keyDir . '/public.pem', 0644);

        return ['private' => (string) $privateKey, 'public' => (string) $publicKey];
    }

    public function privateKey(): string
    {
        $file = $this->keyDir . '/private.pem';
        if (!is_readable($file)) {
            throw new RuntimeException('RSA private key not found. Run the installer.');
        }
        return (string) file_get_contents($file);
    }

    public function publicKey(): string
    {
        $file = $this->keyDir . '/public.pem';
        if (!is_readable($file)) {
            throw new RuntimeException('RSA public key not found. Run the installer.');
        }
        return (string) file_get_contents($file);
    }

    /**
     * Produce a base64 RSA-SHA256 digital signature for data.
     */
    public function sign(string $data): string
    {
        $key = openssl_pkey_get_private($this->privateKey());
        if ($key === false) {
            throw new RuntimeException('Unable to load private key.');
        }

        $signature = '';
        if (!openssl_sign($data, $signature, $key, OPENSSL_ALGO_SHA256)) {
            throw new RuntimeException('Signing failed.');
        }

        return base64_encode($signature);
    }

    /**
     * Verify a base64 RSA-SHA256 signature.
     */
    public function verify(string $data, string $signature, ?string $publicKey = null): bool
    {
        $key = openssl_pkey_get_public($publicKey ?? $this->publicKey());
        if ($key === false) {
            return false;
        }

        $decoded = base64_decode($signature, true);
        if ($decoded === false) {
            return false;
        }

        return openssl_verify($data, $decoded, $key, OPENSSL_ALGO_SHA256) === 1;
    }

    /**
     * SHA-256 checksum of arbitrary data.
     */
    public function checksum(string $data): string
    {
        return hash('sha256', $data);
    }

    public function keysExist(): bool
    {
        return is_readable($this->keyDir . '/private.pem')
            && is_readable($this->keyDir . '/public.pem');
    }
}
