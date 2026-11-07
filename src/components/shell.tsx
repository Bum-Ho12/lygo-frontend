"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { readCsrf } from "@/lib/api/browser";
import { useNotifications } from "@/features/queries";
import { formatWhen } from "@/lib/format";
import { Button } from "@/components/ui";

export type NavItem = { href: string; label: string; exact?: boolean };

function active(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppShell({
  title,
  subtitle,
  nav,
  children,
  portal = false,
  footer,
}: {
  title: string;
  subtitle?: string;
  nav: NavItem[];
  children: ReactNode;
  portal?: boolean;
  footer?: ReactNode;
}) {
  const pathname = usePathname();
  const notifications = useNotifications();
  const [open, setOpen] = useState(false);
  const items = notifications.data?.items ?? [];

  return (
    <div className={`min-h-screen bg-paper text-ink ${portal ? "md:grid md:grid-cols-[220px_1fr]" : "md:grid md:grid-cols-[240px_1fr]"}`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-paper-raised focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="hidden border-r border-line bg-ink text-paper md:flex md:min-h-screen md:flex-col md:px-4 md:py-6">
        <p className="font-display text-2xl">Lygo</p>
        <p className="mt-1 text-sm text-paper/70">{title}</p>
        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label={title}>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active(pathname, item) ? "page" : undefined}
              className={`rounded-lygo px-3 py-2 text-sm ${active(pathname, item) ? "bg-paper text-ink" : "text-paper/80 hover:bg-white/10"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {footer}
      </aside>
      <div className={portal ? "pb-20 md:pb-0" : ""}>
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-8">
          <div>
            <p className="font-display text-lg md:hidden">Lygo</p>
            {subtitle ? <p className="text-sm text-ink-soft">{subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="quiet" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
              Updates
              <span className="sr-only">, {items.length} shown</span>
            </Button>
            <SignOut />
          </div>
        </header>
        {open ? (
          <div className="border-b border-line bg-paper-raised px-4 py-3 md:px-8">
            {notifications.isLoading ? <p>Loading updates…</p> : null}
            {notifications.error ? <p>Updates are unavailable.</p> : null}
            {!notifications.isLoading && items.length === 0 ? <p className="text-sm text-ink-soft">No notifications.</p> : null}
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id} className="text-sm">
                  <span className="font-medium">{item.title || item.template || "Update"}</span>
                  {item.body ? <span className="block text-ink-soft">{item.body}</span> : null}
                  <span className="text-ink-soft">{formatWhen(item.created_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <main id="main" className="px-4 py-6 md:px-8">
          {children}
        </main>
      </div>
      {portal ? (
        <nav className="fixed inset-x-0 bottom-0 flex border-t border-line bg-paper-raised md:hidden" aria-label={title}>
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="flex-1 px-2 py-3 text-center text-xs font-semibold" aria-current={active(pathname, item) ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

function SignOut() {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST", headers: { "X-CSRF-Token": readCsrf() } });
        window.location.assign("/login");
      }}
    >
      Sign out
    </Button>
  );
}
