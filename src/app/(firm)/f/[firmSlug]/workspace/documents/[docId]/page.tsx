import { WorkspaceDocument } from "@/features/workspace/screens";

export default async function Page({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  return <WorkspaceDocument documentId={docId} />;
}
