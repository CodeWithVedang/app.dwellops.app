import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono, Inter } from "next/font/google";
import { UpdatePrompt } from "@/components/pwa/update-prompt";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "DwellOps", template: "%s · DwellOps" },
  description: "Complaints, notices and parcels for your housing society — in one place.",
  applicationName: "DwellOps",
  appleWebApp: { capable: true, title: "DwellOps", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#121826",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${bricolage.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full text-[14px] leading-5">
        {children}
        <UpdatePrompt />
      </body>
    </html>
  );
}
