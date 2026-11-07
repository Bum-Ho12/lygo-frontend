import { MatterScreen } from "@/features/workspace/screens";

export default async function Page({ params }: { params: Promise<{ matterId: string }> }) {
  const { matterId } = await params;
  return <MatterScreen matterId={matterId} />;
}
