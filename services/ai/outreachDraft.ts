export interface OutreachDraft {
  subject: string;
  body: string;
  personalizationNote: string;
}

export const OUTREACH_SUBJECT_MAX_CHARACTERS = 78;
export const OUTREACH_BODY_MAX_CHARACTERS = 1_200;
export const OUTREACH_PERSONALIZATION_NOTE_MAX_CHARACTERS = 240;

export const outreachDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "body", "personalization_note"],
  properties: {
    subject: {
      type: "string",
      minLength: 1,
      maxLength: OUTREACH_SUBJECT_MAX_CHARACTERS
    },
    body: {
      type: "string",
      minLength: 1,
      maxLength: OUTREACH_BODY_MAX_CHARACTERS
    },
    personalization_note: {
      type: "string",
      minLength: 1,
      maxLength: OUTREACH_PERSONALIZATION_NOTE_MAX_CHARACTERS
    }
  }
} as const;

export function parseOutreachDraft(value: unknown): OutreachDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Outreach draft must be an object.");
  }

  const record = value as Record<string, unknown>;
  const subject = requireBoundedText(record.subject, "subject", OUTREACH_SUBJECT_MAX_CHARACTERS);
  const body = requireBoundedText(record.body, "body", OUTREACH_BODY_MAX_CHARACTERS);
  const personalizationNote = requireBoundedText(
    record.personalization_note,
    "personalization_note",
    OUTREACH_PERSONALIZATION_NOTE_MAX_CHARACTERS
  );

  if (/[\r\n\u0000-\u001F\u007F]/.test(subject)) {
    throw new Error("Outreach subject must be a single safe header line.");
  }

  if (/https?:\/\//i.test(body)) {
    throw new Error("Outreach draft body must not invent or insert links.");
  }

  return { subject, body, personalizationNote };
}

function requireBoundedText(value: unknown, fieldName: string, maximumLength: number) {
  if (typeof value !== "string") throw new Error(`${fieldName} must be text.`);
  const text = value.trim();
  if (!text || text.length > maximumLength) {
    throw new Error(`${fieldName} must contain 1-${maximumLength} characters.`);
  }
  return text;
}
