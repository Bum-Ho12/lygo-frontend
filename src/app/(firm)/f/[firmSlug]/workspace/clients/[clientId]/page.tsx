import { ClientDashboard } from "@/features/workspace/screens";

export default async function Page({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <ClientDashboard clientId={clientId} />;
}
