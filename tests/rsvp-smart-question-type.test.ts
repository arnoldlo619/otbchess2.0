import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getSmartRsvpQuestionConfig,
  inferRsvpQuestionType,
} from "../shared/rsvpMeetupTemplate";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("smart RSVP question types", () => {
  it.each([
    ["Chess.com username", "text"],
    ["Will you attend the meetup?", "radio"],
    ["What would you like to join?", "checkbox"],
    ["Which start time do you prefer?", "select"],
    ["What is your chess.com rating?", "number"],
    ["Any additional notes for the organizer?", "textarea"],
  ] as const)("infers %s as %s", (label, expectedType) => {
    expect(inferRsvpQuestionType(label)).toBe(expectedType);
  });

  it("seeds sensible options only when an inferred question needs them", () => {
    expect(getSmartRsvpQuestionConfig("Will you attend?")).toEqual({
      type: "radio",
      typeSource: "smart",
      options: ["Yes", "No"],
    });
    expect(getSmartRsvpQuestionConfig("Which start time do you prefer?")).toEqual({
      type: "select",
      typeSource: "smart",
      options: ["Option 1"],
    });
    expect(getSmartRsvpQuestionConfig("Chess.com username")).toEqual({
      type: "text",
      typeSource: "smart",
      options: undefined,
    });
  });

  it("preserves owner-authored choices when the same smart type remains appropriate", () => {
    expect(getSmartRsvpQuestionConfig("Will you attend the meetup?", {
      type: "radio",
      options: ["Yes", "No", "Maybe"],
    })).toEqual({
      type: "radio",
      typeSource: "smart",
      options: ["Yes", "No", "Maybe"],
    });
  });

  it("keeps manual type selection available while full-page inference stays silent", () => {
    const inlineBuilder = read("client/src/components/club/RsvpFormBuilder.tsx");
    const fullBuilder = read("client/src/pages/RsvpFormBuilderPage.tsx");

    expect(inlineBuilder).toContain('typeSource: "manual"');
    expect(inlineBuilder).toContain("Use smart type");
    expect(fullBuilder).toContain('typeSource: "manual"');
    expect(fullBuilder).toContain('getSmartRsvpQuestionConfig(label, question)');
    expect(fullBuilder).not.toContain("Use smart type");
    expect(fullBuilder).not.toContain(">Smart type<");
    expect(fullBuilder).toContain("function addQuestion(type?: QuestionType)");
  });
});
