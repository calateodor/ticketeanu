// Cod de bare decorativ, generat determinist din cod. Identitatea biletului e codul QR;
// barele sunt pentru aerul de bilet tipărit, ca în referință.
export function Barcode({ code, vertical = false, className }: { code: string; vertical?: boolean; className?: string }) {
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (let i = 0; i < code.length * 4; i++) {
    const ch = code.charCodeAt(i % code.length) + i * 7;
    const w = 1 + (ch % 3);
    bars.push({ x, w });
    x += w + 1 + ((ch >> 2) % 2);
  }
  const total = x;
  const h = 40;
  return (
    <svg
      viewBox={vertical ? `0 0 ${h} ${total}` : `0 0 ${total} ${h}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      {bars.map((b, i) =>
        vertical ? <rect key={i} x={0} y={b.x} width={h} height={b.w} fill="currentColor" /> : <rect key={i} x={b.x} y={0} width={b.w} height={h} fill="currentColor" />,
      )}
    </svg>
  );
}
