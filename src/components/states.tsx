"use client";

import type { ReactNode } from "react";
import { ApiError, problemMessage } from "@/lib/api/problem";
import { Button } from "@/components/ui";

export function errorText(error: unknown): string {
  if (error instanceof ApiError) return problemMessage(error.problem);
  return "Something went wrong";
}

export function ProblemView({ error }: { error: unknown }) {
  const message = errorText(error);
  return (
    <div role="alert" className="rounded-lygo border border-line bg-paper-raised p-4">
      <h2 className="font-display text-xl">{message}</h2>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lygo border border-dashed border-line px-4 py-10 text-center">
      <h2 className="font-display text-2xl">{title}</h2>
      {body ? <p className="mx-auto mt-2 max-w-md text-ink-soft">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <p className="text-ink-soft" role="status">
      {label}…
    </p>
  );
}

export function QueryState({
  isLoading,
  error,
  empty,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  empty?: { when: boolean; title: string; body?: string } | null;
  children: ReactNode;
}) {
  if (isLoading) return <LoadingBlock />;
  if (error) return <ProblemView error={error} />;
  if (empty?.when) return <EmptyState title={empty.title} body={empty.body} />;
  return children;
}

export function LoadMore({
  hasNextPage,
  isFetchingNextPage,
  onClick,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onClick: () => void;
}) {
  if (!hasNextPage) return null;
  return (
    <Button type="button" variant="quiet" onClick={onClick} disabled={isFetchingNextPage}>
      {isFetchingNextPage ? "Loading…" : "Load more"}
    </Button>
  );
}
