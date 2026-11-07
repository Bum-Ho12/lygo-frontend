"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

/**
 * A destructive action that asks first, in place: the first click shows the question, the second does it.
 * No modal; focus moves to the confirm button; it quietly resets after a few seconds or on Cancel.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  question,
  onConfirm,
  disabled,
  variant = "ghost",
}: {
  label: string;
  confirmLabel?: string;
  question: string;
  onConfirm: () => void;
  disabled?: boolean;
  variant?: "ghost" | "quiet" | "danger";
}) {
  const [asking, setAsking] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!asking) return;
    confirmRef.current?.focus();
    const timer = setTimeout(() => setAsking(false), 8000);
    return () => clearTimeout(timer);
  }, [asking]);

  if (!asking) {
    return (
      <Button type="button" variant={variant} disabled={disabled} onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  }
  return (
    <span role="group" aria-label={question} className="inline-flex flex-wrap items-center gap-2 rounded-lygo border border-critical/40 bg-critical/5 px-2 py-1">
      <span className="text-sm">{question}</span>
      <Button
        ref={confirmRef}
        type="button"
        variant="danger"
        disabled={disabled}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel ?? label}
      </Button>
      <Button type="button" variant="quiet" onClick={() => setAsking(false)}>
        Cancel
      </Button>
    </span>
  );
}
