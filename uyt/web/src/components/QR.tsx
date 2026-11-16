import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

/** Renders a QR to canvas; `onReady` gets a PNG data URL (for download/print). */
export function QR({ value, size = 240, onReady, dark = '#0A0A0A' }: { value: string; size?: number; onReady?: (png: string) => void; dark?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    QRCode.toCanvas(ref.current, value, { width: size, margin: 2, errorCorrectionLevel: 'M', color: { dark, light: '#FFFFFF' } }, () => {
      if (onReady && ref.current) onReady(ref.current.toDataURL('image/png'));
    });
  }, [value, size, dark, onReady]);
  return <canvas ref={ref} width={size} height={size} style={{ width: size, height: size }} aria-label="QR code" />;
}

export const qrDataUrl = (value: string, size = 1024) =>
  QRCode.toDataURL(value, { width: size, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0A0A0A', light: '#FFFFFF' } });
