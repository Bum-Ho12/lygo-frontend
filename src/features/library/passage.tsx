"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/browser";
import { apiPaths } from "@/lib/api/paths";
import type { SearchHit } from "@/lib/api/types";
function showDay(value: string) {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-KE", { timeZone: "UTC", dateStyle: "medium" }).format(date);
}
import { Button, Field, PageHeader, TextInput } from "@/components/ui";
import { errorText } from "@/components/states";

export function LawPassage({ sourceId, initialSection, backHref }: { sourceId: string; initialSection: string; backHref: string }) {
  const [section, setSection] = useState(initialSection);
  const [submitted, setSubmitted] = useState(initialSection.trim());
  const passage = useQuery({
    queryKey: ["corpus", "section", sourceId, submitted],
    enabled: submitted.length > 0,
    queryFn: () => api<SearchHit[]>(apiPaths.corpusSection(sourceId, submitted)),
  });
  const hits = passage.data ?? [];
  const title = hits[0]?.citation.title || "Section";

  return (
    <div className="space-y-6">
      <PageHeader
        title={submitted ? title : "Open a section"}
        lede="The text of one section from the public law library."
        action={
          <Link href={backHref} className="text-sm underline">
            Back to search
          </Link>
        }
      />
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(section.trim());
        }}
      >
        <Field label="Section" hint="For example, s.12">
          <TextInput value={section} onChange={(event) => setSection(event.target.value)} required />
        </Field>
        <Button type="submit">Show</Button>
      </form>
      {passage.isLoading ? <p className="text-sm text-ink-soft">Opening the section…</p> : null}
      {passage.error ? <p className="text-sm text-critical">{errorText(passage.error)}</p> : null}
      <ul className="space-y-4">
        {hits.map((hit) => (
          <li key={hit.citation.chunk_id} className="rounded-lygo border border-line bg-paper-raised p-4 text-sm">
            <p className="font-medium">{hit.citation.section_ref || "Passage"}</p>
            <p className="text-ink-soft">
              {hit.citation.version || "Current"}
              {hit.citation.effective_from ? ` · in force from ${showDay(hit.citation.effective_from)}` : ""}
              {hit.citation.page ? ` · page ${hit.citation.page}` : ""}
            </p>
            <p className="mt-3 whitespace-pre-wrap">{hit.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
