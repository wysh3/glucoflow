import * as React from 'react';
import QRCode from 'qrcode';

export function ReceiptQr({ value, size = 128, label = 'Receipt verification QR code' }: { value: string; size?: number; label?: string }): React.ReactElement {
  const [src, setSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    void QRCode.toDataURL(value, { margin: 1, width: size, errorCorrectionLevel: 'M' })
      .then((data) => { if (live) setSrc(data); })
      .catch(() => { if (live) setSrc(null); });
    return () => { live = false; };
  }, [value, size]);

  if (!src) return <div className="size-[128px] animate-pulse rounded bg-line" aria-label={label} />;
  return <img src={src} width={size} height={size} alt={label} className="rounded bg-white p-1" />;
}
