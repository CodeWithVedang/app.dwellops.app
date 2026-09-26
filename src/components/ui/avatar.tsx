// Deterministic, readable initials avatar. Hue comes from the name so the same person always looks the same.
const TONES = [
  "bg-[#E6F4F3] text-[#0A5553]",
  "bg-[#FDF3E1] text-[#8A5A0B]",
  "bg-[#EAF1FB] text-[#1D4E89]",
  "bg-[#F4ECF7] text-[#6B3A7A]",
  "bg-[#EEF5E9] text-[#3C6424]",
  "bg-[#FBEDEA] text-[#8C3B2A]",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function Avatar({ name, size = "md", tone = "light" }: { name: string; size?: "sm" | "md"; tone?: "light" | "dark" }) {
  const dims = size === "sm" ? "size-8 text-[11px]" : "size-9 text-xs";
  const color = tone === "dark" ? "bg-white/10 text-white ring-1 ring-white/10" : TONES[hash(name) % TONES.length];
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${dims} ${color}`} aria-hidden>
      {initials(name)}
    </span>
  );
}
