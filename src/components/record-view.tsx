import type { ReactNode } from "react";
import { labelize } from "@/lib/format";

export function RecordView({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const entries = Object.entries(record).filter(([, value]) => value != null);
  if (entries.length === 0) return null;
  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-2">
        {entries
          .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
          .map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs uppercase tracking-wide text-ink-soft">{labelize(key)}</dt>
              <dd className="text-sm">{String(value)}</dd>
            </div>
          ))}
      </dl>
      {entries
        .filter(([, value]) => Array.isArray(value) && value.every((item) => typeof item === "string"))
        .map(([key, value]) => (
          <section key={key}>
            <h3 className="font-display text-lg">{labelize(key)}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {(value as string[]).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
}: {
  rows: T[];
  columns: { header: string; cell: (row: T) => ReactNode }[];
}) {
  return (
    <div className="overflow-x-auto rounded-lygo border border-line">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <thead className="bg-paper text-ink-soft">
          <tr>
            {columns.map((column) => (
              <th key={column.header} scope="col" className="px-3 py-2 font-medium">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-line bg-paper-raised">
              {columns.map((column) => (
                <td key={column.header} className="px-3 py-2 align-top">
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
