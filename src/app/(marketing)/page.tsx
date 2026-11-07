import Link from "next/link";
import { ApiStatus } from "./status";

const surfaces = [
  ["Platform console", "Onboard firms, publish the public law corpus, and watch the workers."],
  ["Control center", "Members, clients, storage residency, rule packs, and the audit log."],
  ["Workspace", "Matters, knowledge, research with citations, and the review queue."],
  ["Client portal", "Upload a scan, read flags in plain language, ask the assistant."],
];

export default function HomePage() {
  return (
    <main>
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:bg-paper-raised focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <p className="font-display text-2xl">Lygo</p>
        <nav className="flex gap-4 text-sm">
          <Link href="/register-firm">For firms</Link>
          <Link href="/login">Sign in</Link>
          <Link href="/register" className="rounded-lygo bg-brand px-3 py-2 font-semibold text-brand-foreground">
            Create account
          </Link>
        </nav>
      </header>
      <section id="content" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-[1.3fr_0.7fr] md:px-10">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-accent">Kenya · law firms</p>
          <h1 className="mt-3 font-display text-5xl leading-[1.05] md:text-6xl">The matter file, kept in order.</h1>
          <p className="mt-5 max-w-xl text-lg text-ink-soft">
            Lygo digitises the documents a firm and its clients already hold, flags what needs a person, and answers from the passage it used.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/login" className="rounded-lygo bg-ink px-4 py-2 font-semibold text-paper">
              Open Lygo
            </Link>
            <Link href="/register-firm" className="rounded-lygo border border-line bg-paper-raised px-4 py-2 font-semibold">
              Register your firm
            </Link>
            <ApiStatus />
          </div>
        </div>
        <aside className="rounded-lygo border border-line bg-paper-raised p-5">
          <p className="font-display text-2xl">Four doors, one API</p>
          <ul className="mt-4 space-y-4">
            {surfaces.map(([title, body]) => (
              <li key={title}>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-ink-soft">{body}</p>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </main>
  );
}
