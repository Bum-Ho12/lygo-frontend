import { FirmDetailScreen } from "@/features/platform/screens";

export default async function FirmDetailPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = await params;
  return <FirmDetailScreen firmId={firmId} />;
}
