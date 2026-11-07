import type { ReactNode } from "react";

export const metadata = { title: "Lygo", description: "Legal data platform for law firms and their clients" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
