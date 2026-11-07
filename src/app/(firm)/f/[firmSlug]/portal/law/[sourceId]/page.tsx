import { LawPassage } from "@/features/library/passage";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ firmSlug: string; sourceId: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { firmSlug, sourceId } = await params;
  const { section } = await searchParams;
  return <LawPassage sourceId={sourceId} initialSection={section ?? ""} backHref={`/f/${firmSlug}/portal/search`} />;
}
