"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export default function JoinQr({ code }: { code: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!code) return;
    const url = `${window.location.origin}/join/${code}`;
    QRCode.toDataURL(url, {
      width: 320,
      margin: 1,
      color: { dark: "#171717", light: "#ffffff" },
    })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [code]);

  if (!src) return null;

  return (
    <div className="rounded-xl border border-border bg-white p-2">
      {/* Next Image is unnecessary for a generated data URL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`QR code to join room ${code}`}
        className="h-28 w-28 sm:h-32 sm:w-32"
      />
      <p className="mt-1 text-center font-mono text-[10px] font-bold text-[#4c4652]">
        Scan to join
      </p>
    </div>
  );
}
