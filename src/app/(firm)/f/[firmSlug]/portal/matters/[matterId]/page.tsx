import { PortalMatter } from "@/features/portal/screens";

export default async function Page({ params }: { params: Promise<{ matterId: string }> }) {
  const { matterId } = await params;
  return <PortalMatter matterId={matterId} />;
}
