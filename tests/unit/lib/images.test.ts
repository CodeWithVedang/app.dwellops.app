import { describe, expect, it } from "vitest";
import { cleanFileName, sniffImage } from "@/lib/storage/images";

const bytes = (...b: number[]) => new Uint8Array(b);

describe("sniffImage", () => {
  it("detects JPEG, PNG and WebP from magic bytes", () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe("image/jpeg");
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.mime).toBe("image/png");
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(sniffImage(webp)?.mime).toBe("image/webp");
  });

  it("rejects everything else, whatever the name says", () => {
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(sniffImage(bytes())).toBeNull();
  });
});

describe("cleanFileName", () => {
  it("strips paths and odd characters", () => {
    expect(cleanFileName("C:\\Users\\x\\..\\evil<script>.jpg")).toBe("evil_script_.jpg");
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
  });
});
