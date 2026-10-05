/**
 * The concise default used when a Club Event first receives an RSVP form.
 * IDs are supplied by the caller so the template works for both client drafts
 * and durable server-side form creation.
 */
export type RsvpQuestionType = "text" | "textarea" | "radio" | "checkbox" | "select" | "number";

export type RsvpIdentityField = "respondentName" | "respondentEmail";

export interface RsvpFormQuestion {
  id: string;
  type: RsvpQuestionType;
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
  /** Lets the public form retain response attribution without duplicate inputs. */
  fieldKey?: RsvpIdentityField;
}

export function createClubMeetupRsvpQuestions(createId: () => string): RsvpFormQuestion[] {
  return [
    {
      id: createId(),
      type: "text",
      label: "Name",
      required: true,
      placeholder: "Your full name",
      fieldKey: "respondentName",
    },
    {
      id: createId(),
      type: "text",
      label: "Chess.com username",
      required: false,
      placeholder: "Optional",
    },
    {
      id: createId(),
      type: "checkbox",
      label: "What would you like to join?",
      required: true,
      options: ["Casual open play", "Casual tournament"],
    },
    {
      id: createId(),
      type: "text",
      label: "Email address",
      required: true,
      placeholder: "you@example.com",
      fieldKey: "respondentEmail",
    },
  ];
}
