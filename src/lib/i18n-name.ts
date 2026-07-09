// Picks the locale-appropriate display name for taxonomy rows (subjects/topics),
// falling back to Bangla when an English name is missing.
export function localName(
  row: { name_bn: string; name_en?: string | null },
  locale: string
): string {
  return locale === "en" && row.name_en ? row.name_en : row.name_bn;
}
