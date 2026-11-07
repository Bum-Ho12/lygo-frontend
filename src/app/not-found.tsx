import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <p className="text-sm uppercase tracking-wide text-ink-soft">404</p>
      <h1 className="font-display text-4xl">That page is not on the file.</h1>
      <Link href="/" className="mt-4 underline">
        Back to Lygo
      </Link>
    </main>
  );
}
