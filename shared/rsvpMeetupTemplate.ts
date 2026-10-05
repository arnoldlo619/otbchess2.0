/**
 * The concise default used when a Club Event first receives an RSVP form.
 * IDs are supplied by the caller so the template works for both client drafts
 * and durable server-side form creation.
 */
export type RsvpQuestionType = "text" | "textarea" | "radio" | "checkbox" | "select" | "number";
export type RsvpQuestionTypeSource = "smart" | "manual";
export type RsvpIdentityField = "respondentName" | "respondentEmail";

export interface RsvpFormQuestion {
  id: string;
  type: RsvpQuestionType;
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
  /** Smart types update as an owner writes; manual types are an explicit override. */
  typeSource?: RsvpQuestionTypeSource;
  /** Lets the public form retain response attribution without duplicate inputs. */
  fieldKey?: RsvpIdentityField;
}

export interface SmartRsvpQuestionConfig {
  type: RsvpQuestionType;
  typeSource: "smart";
  options?: string[];
}

const CHOICE_TYPES: RsvpQuestionType[] = ["radio", "checkbox", "select"];

function isChoiceType(type: RsvpQuestionType): boolean {
  return CHOICE_TYPES.includes(type);
}

/**
 * Infer an accessible, low-friction answer control from common RSVP wording.
 * This stays local and deterministic so form contents never leave the browser.
 */
export function inferRsvpQuestionType(label: string): RsvpQuestionType {
  const normalized = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
  if (!normalized) return "text";

  if (/\b(notes?|comments?|message|describe|details?|anything else|tell us|why)\b/.test(normalized)) {
    return "textarea";
  }
  if (/\b(how many|number of|rating|elo|age|years? of|minutes?|hours?)\b/.test(normalized)) {
    return "number";
  }
  if (/\b(select all|check all|all that apply|and or|activities|interests?|would you like to join)\b/.test(normalized)) {
    return "checkbox";
  }
  if (/\b(dropdown|select one|choose one|prefer(?:red|ence)?)\b/.test(normalized)) {
    return "select";
  }
  if (/\b(yes no|will you|are you|do you|can you|have you|is this)\b/.test(normalized)) {
    return "radio";
  }
  return "text";
}

function defaultOptionsForSmartType(type: RsvpQuestionType, label: string): string[] | undefined {
  if (type === "radio" && /\b(yes no|will you|are you|do you|can you|have you|is this)\b/.test(label.toLowerCase())) {
    return ["Yes", "No"];
  }
  return isChoiceType(type) ? ["Option 1"] : undefined;
}

/**
 * Returns a non-destructive configuration suitable for a label update. Existing
 * options remain intact while the inferred control type stays the same.
 */
export function getSmartRsvpQuestionConfig(
  label: string,
  current?: Pick<RsvpFormQuestion, "type" | "options">
): SmartRsvpQuestionConfig {
  const type = inferRsvpQuestionType(label);
  const preserveOptions = current?.type === type && (current.options?.length ?? 0) > 0;
  return {
    type,
    typeSource: "smart",
    options: preserveOptions ? current?.options : defaultOptionsForSmartType(type, label),
  };
}

export function createClubMeetupRsvpQuestions(createId: () => string): RsvpFormQuestion[] {
  return [
    {
      id: createId(),
      type: "text",
      typeSource: "smart",
      label: "Name",
      required: true,
      placeholder: "Your full name",
      fieldKey: "respondentName",
    },
    {
      id: createId(),
      type: "text",
      typeSource: "smart",
      label: "Chess.com username",
      required: false,
      placeholder: "Optional",
    },
    {
      id: createId(),
      type: "checkbox",
      typeSource: "smart",
      label: "What would you like to join?",
      required: true,
      options: ["Casual open play", "Casual tournament"],
    },
    {
      id: createId(),
      type: "text",
      typeSource: "smart",
      label: "Email address",
      required: true,
      placeholder: "you@example.com",
      fieldKey: "respondentEmail",
    },
  ];
}
