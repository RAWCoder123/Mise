import type { AppLocale } from "./catalog";

interface LanguageDocumentRoot {
  document?: {
    documentElement?: {
      lang: string;
    };
  };
}

/**
 * Keep the web document language aligned with the active operator locale.
 *
 * The small structural type deliberately avoids depending on DOM globals so
 * native TypeScript builds and Node tests can load this module safely.
 */
export function syncDocumentLanguage(
  locale: AppLocale,
  platform: string,
  runtimeRoot: unknown = globalThis
): boolean {
  if (platform !== "web" || !runtimeRoot || typeof runtimeRoot !== "object") return false;

  const documentElement = (runtimeRoot as LanguageDocumentRoot).document?.documentElement;
  if (!documentElement) return false;

  documentElement.lang = locale;
  return true;
}
