import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden flex-col justify-between bg-ink px-10 py-12 text-paper lg:flex">
        <p className="font-display text-3xl">Lygo</p>
        <div>
          <p className="font-display text-5xl leading-tight">The matter file, kept in order.</p>
          <p className="mt-4 max-w-md text-paper/75">
            Citations stay on the answer. Flags stay explainable. Client papers stay in the firm’s store.
          </p>
        </div>
        <p className="text-sm text-paper/60">Africa/Nairobi · en-KE</p>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-8 inline-flex items-center justify-center rounded-lygo border border-line bg-paper-raised px-3 py-2 text-sm font-semibold hover:bg-paper"
          >
            Home
          </Link>
          {children}
        </div>
      </section>
    </div>
  );
}
