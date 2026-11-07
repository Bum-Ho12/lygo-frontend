import { PortalDocument } from "@/features/portal/screens";

export default async function Page({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  return <PortalDocument documentId={docId} />;
}
