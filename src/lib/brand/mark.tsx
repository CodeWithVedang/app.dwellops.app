/**
 * DwellOps brand mark for generated images (app icons, PWA icons).
 * Inline styles only — ImageResponse does not read Tailwind classes.
 * Glyph: a roof over a lit window (saffron) — "someone is home and on it".
 */
export const BRAND = { ink: "#121826", harbor: "#0D7C79", harborDark: "#0A5553", saffron: "#F4A62A", paper: "#F7F6F3" } as const;

export function BrandMark({ size, padding = 0.18, radius = 0.22 }: { size: number; padding?: number; radius?: number }) {
  const inner = size * (1 - padding * 2);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(145deg, ${BRAND.harbor} 0%, ${BRAND.harborDark} 100%)`,
        borderRadius: size * radius,
      }}
    >
      <svg width={inner} height={inner} viewBox="0 0 32 32" fill="none">
        <path d="M4 15.5 16 5l12 10.5" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 13.5V26h16V13.5" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="13" y="16" width="6" height="6" rx="1.4" fill={BRAND.saffron} />
      </svg>
    </div>
  );
}
