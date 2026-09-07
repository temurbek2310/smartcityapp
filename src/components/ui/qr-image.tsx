"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrImage({ value, size = 220 }: { value: string; size?: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    void QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: "M" }).then((data) => {
      if (alive) setSrc(data);
    });
    return () => { alive = false; };
  }, [value, size]);

  if (!src) return <div style={{ width: size, height: size }} className="animate-pulse rounded-2xl bg-slate-100" />;
  return <img src={src} alt="Reservation QR code" width={size} height={size} className="rounded-2xl" />;
}
