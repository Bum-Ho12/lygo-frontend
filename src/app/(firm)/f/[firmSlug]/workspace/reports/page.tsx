import { redirect } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ firmSlug: string }> }) {
  const { firmSlug } = await params;
  redirect(`/f/${firmSlug}/workspace/practice`);
}
