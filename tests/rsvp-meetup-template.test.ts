import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createClubMeetupRsvpQuestions } from "../shared/rsvpMeetupTemplate";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Club Meetup RSVP template", () => {
  it("creates the four concise, editable questions needed for a club meetup", () => {
    let sequence = 0;
    const questions = createClubMeetupRsvpQuestions(() => `template-${++sequence}`);

    expect(questions).toHaveLength(4);
    expect(questions).toEqual([
      expect.objectContaining({ id: "template-1", label: "Name", type: "text", required: true, fieldKey: "respondentName" }),
      expect.objectContaining({ id: "template-2", label: "Chess.com username", type: "text", required: false }),
      expect.objectContaining({
        id: "template-3",
        label: "What would you like to join?",
        type: "checkbox",
        required: true,
        options: ["Casual open play", "Casual tournament"],
      }),
      expect.objectContaining({ id: "template-4", label: "Email address", type: "text", required: true, fieldKey: "respondentEmail" }),
    ]);
  });

  it("uses the shared template for every new builder and direct API form creation", () => {
    const inlineBuilder = read("client/src/components/club/RsvpFormBuilder.tsx");
    const fullBuilder = read("client/src/pages/RsvpFormBuilderPage.tsx");
    const server = read("server/clubs.ts");

    expect(inlineBuilder).toContain("setQuestions(createClubMeetupRsvpQuestions(nanoid8))");
    expect(fullBuilder).toContain("questions: createClubMeetupRsvpQuestions(() => nanoid())");
    expect(server).toContain("questions: (questions ?? createClubMeetupRsvpQuestions(() => nanoid(12))) as unknown[]");
  });

  it("uses the template identity fields without rendering duplicate public inputs", () => {
    const publicForm = read("client/src/pages/RsvpFormPage.tsx");

    expect(publicForm).toContain('question.fieldKey === "respondentName"');
    expect(publicForm).toContain('question.fieldKey === "respondentEmail"');
    expect(publicForm).toContain("const questions = allQuestions.filter((question) => !question.fieldKey)");
    expect(publicForm).toContain("answer: answerForQuestion(q)");
  });
});
