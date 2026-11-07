import type { ReactNode } from "react";
import { PlatformGate } from "@/components/platform-gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Platform" };

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return <PlatformGate>{children}</PlatformGate>;
}
