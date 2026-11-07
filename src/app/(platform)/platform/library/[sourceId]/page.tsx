import { LawPassage } from "@/features/library/passage";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ sourceId: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { sourceId } = await params;
  const { section } = await searchParams;
  return <LawPassage sourceId={sourceId} initialSection={section ?? ""} backHref="/platform/library" />;
}
