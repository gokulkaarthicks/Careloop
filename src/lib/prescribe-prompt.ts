/**
 * Strip common e-prescribe command verbs so "prescribe tylenol" → medication "tylenol".
 */
export function extractMedicationFromPrescribePrompt(raw: string): string {
  let s = raw.trim();
  if (!s) return "";

  const patterns: RegExp[] = [
    /^(prescribe|prescribing)\s+/i,
    /^(rx|prescription)\s*[:\s]*/i,
    /^add\s+(a\s+)?(new\s+)?(rx|med|medication|prescription|prescriptions?)\s*[:\s]*/i,
    /^new\s+(rx|med|medication|prescription)\s*[:\s]*/i,
    /^order\s+[:\s]*/i,
    /^start\s+[:\s]*/i,
  ];

  for (const re of patterns) {
    s = s.replace(re, "").trim();
  }

  return s.slice(0, 160).trim();
}
