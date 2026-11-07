import type { ComponentProps, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const buttonVariants = {
  primary: "bg-brand text-brand-foreground hover:opacity-90",
  quiet: "border border-line bg-paper-raised hover:bg-paper",
  danger: "bg-critical text-white hover:opacity-90",
  ghost: "hover:bg-black/5",
} as const;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof buttonVariants }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lygo px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]} ${className}`}
      {...props}
    />
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lygo border border-line bg-paper px-3 py-2 text-base text-ink shadow-[inset_0_0_0_1px_var(--line)] ${props.className ?? ""}`}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lygo border border-line bg-paper px-3 py-2 text-base text-ink shadow-[inset_0_0_0_1px_var(--line)] ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lygo border border-line bg-paper px-3 py-2 text-base text-ink shadow-[inset_0_0_0_1px_var(--line)] ${props.className ?? ""}`}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-ink-soft">{hint}</span> : null}
    </label>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lygo border border-line bg-paper-raised p-4 shadow-[var(--shadow)] ${className}`}>{children}</section>;
}

export function PageHeader({ title, lede, action }: { title: string; lede?: string; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl text-ink">{title}</h1>
        {lede ? <p className="mt-1 max-w-2xl text-ink-soft">{lede}</p> : null}
      </div>
      {action}
    </header>
  );
}

