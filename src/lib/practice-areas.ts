/** One list of practice areas for the whole app (firm sign-up, matters, filters). */
export const PRACTICE_AREAS: { value: string; label: string }[] = [
  { value: "general", label: "General practice" },
  { value: "litigation", label: "Litigation" },
  { value: "commercial", label: "Commercial" },
  { value: "conveyancing", label: "Conveyancing" },
  { value: "insurance", label: "Insurance" },
  { value: "employment", label: "Employment" },
  { value: "family", label: "Family" },
  { value: "immigration", label: "Immigration" },
  { value: "criminal", label: "Criminal" },
  { value: "tax", label: "Tax" },
  { value: "banking", label: "Banking & finance" },
  { value: "intellectual_property", label: "Intellectual property" },
  { value: "probate", label: "Probate & succession" },
  { value: "other", label: "Other" },
];

export function practiceAreaLabel(value: string | null | undefined): string {
  if (!value) return "";
  return PRACTICE_AREAS.find((area) => area.value === value)?.label ?? value.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}
