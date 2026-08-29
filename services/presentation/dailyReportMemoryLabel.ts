import type { AppLocale } from "../../i18n/catalog";
import type { LearningMemoryPresentationDescriptor } from "../../types/presentation";
import { presentLearningMemory } from "./operationsPresentation";

export interface DailyReportLearningMemoryFields {
  memoryLabel: string | null;
  memoryCopy: string | null;
  memoryNextStep: string | null;
  memoryPresentation: LearningMemoryPresentationDescriptor | null;
}

/**
 * Present structured learning-memory codes when available; otherwise keep the
 * raw evidence strings (no invented facts).
 */
export function presentDailyReportMemory(
  locale: AppLocale,
  learning: DailyReportLearningMemoryFields
): { memoryCopy: string | null; memoryNextStep: string | null } {
  if (!learning.memoryPresentation) {
    return {
      memoryCopy: learning.memoryCopy,
      memoryNextStep: learning.memoryNextStep
    };
  }
  const presented = presentLearningMemory(locale, {
    score: 0,
    label: learning.memoryLabel ?? "",
    operatorCopy: learning.memoryCopy ?? "",
    nextStep: learning.memoryNextStep ?? "",
    signals: [],
    presentation: learning.memoryPresentation
  });
  return {
    memoryCopy: learning.memoryCopy ? presented.operatorCopy : null,
    memoryNextStep: learning.memoryNextStep ? presented.nextStep : null
  };
}
