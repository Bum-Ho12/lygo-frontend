import { RegisterForm } from "@/features/auth/register-form";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <RegisterForm invitationToken={token} />;
}
