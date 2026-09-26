import { ImageResponse } from "next/og";
import { BrandMark, BRAND } from "@/lib/brand/mark";

// /icons/192, /icons/512 (rounded, "any") and /icons/maskable (full-bleed with safe zone).
export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }, { size: "maskable" }];
}

export async function GET(_: Request, { params }: RouteContext<"/icons/[size]">) {
  const { size } = await params;
  if (size === "maskable") {
    return new ImageResponse(
      (
        <div style={{ width: 512, height: 512, display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.harbor }}>
          <BrandMark size={340} padding={0.12} radius={0} />
        </div>
      ),
      { width: 512, height: 512 },
    );
  }
  const px = size === "512" ? 512 : 192;
  return new ImageResponse(<BrandMark size={px} />, { width: px, height: px });
}
