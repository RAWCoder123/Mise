import { requireManagerCorrectionNote } from "../miseValidation";

export function buildManagerCorrectionMetadata(input: {
  parLevel: number;
  reorderThreshold: number;
  note?: string | null;
}): Record<string, unknown> {
  const note = requireManagerCorrectionNote(input.note);
  return {
    par_level: input.parLevel,
    reorder_threshold: input.reorderThreshold,
    ...(note ? { note } : {})
  };
}
