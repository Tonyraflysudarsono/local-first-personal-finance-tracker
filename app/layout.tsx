import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neraca | Keuangan Pribadi",
  description: "Dashboard keuangan pribadi yang menyimpan data secara lokal di browser.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
