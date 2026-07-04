"use client";

import { useEffect, useMemo, useState } from "react";
import * as QRCode from "qrcode";

type QrCodeProps = {
  text: string;
  size?: number;
  label?: string;
  downloadName?: string;
};

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function QrCode({
  text,
  size = 180,
  label = "QR code",
  downloadName,
}: QrCodeProps) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    setSvg(null);
    QRCode.toString(text, {
      type: "svg",
      width: size,
      margin: 1,
      color: { dark: "#111111", light: "#ffffff" },
    })
      .then((result: string) => {
        if (!canceled) setSvg(result);
      })
      .catch(() => {
        if (!canceled) setSvg(null);
      });
    return () => {
      canceled = true;
    };
  }, [text, size]);

  const dataUrl = useMemo(() => (svg ? svgDataUrl(svg) : null), [svg]);

  if (!dataUrl) {
    return (
      <div
        className="qr-code qr-code-loading"
        style={{ width: size, height: size }}
        aria-label={`${label} loading`}
      >
        Generating...
      </div>
    );
  }

  return (
    <div className="qr-code-wrap">
      <img
        className="qr-code"
        src={dataUrl}
        width={size}
        height={size}
        alt={label}
      />
      {downloadName ? (
        <a
          className="link-btn ghost no-print"
          href={dataUrl}
          download={downloadName}
        >
          Download SVG
        </a>
      ) : null}
    </div>
  );
}
