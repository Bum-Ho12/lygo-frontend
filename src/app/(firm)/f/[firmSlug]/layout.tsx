import type { ReactNode } from "react";
import { FirmGate } from "@/components/firm-gate";

export const dynamic = "force-dynamic";

export default async function FirmLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ firmSlug: string }>;
}) {
  const { firmSlug } = await params;
  return <FirmGate firmSlug={firmSlug}>{children}</FirmGate>;
}
