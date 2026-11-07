import type { ReactNode } from "react";
import { Newsreader, Source_Sans_3 } from "next/font/google";
import { Providers } from "@/lib/query/provider";
import "./globals.css";

const display = Newsreader({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Source_Sans_3({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata = {
  title: { default: "Lygo", template: "%s · Lygo" },
  description: "Legal data platform for law firms and their clients",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
