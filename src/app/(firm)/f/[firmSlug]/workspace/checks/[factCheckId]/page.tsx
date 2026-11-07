import { FactCheckDetail } from "@/features/intelligence/screens";

export default async function Page({ params }: { params: Promise<{ factCheckId: string }> }) {
  const { factCheckId } = await params;
  return <FactCheckDetail factCheckId={factCheckId} />;
}
