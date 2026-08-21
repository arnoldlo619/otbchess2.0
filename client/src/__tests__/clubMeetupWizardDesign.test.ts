import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const meetupWizardSource = readFileSync(
  resolve(process.cwd(), "client/src/components/ClubMeetupWizard.tsx"),
  "utf8",
);

describe("Club Meetup Wizard design", () => {
  it("uses the same spacious full-page creation hierarchy as Tournament Setup", () => {
    expect(meetupWizardSource).toContain("max-w-5xl");
    expect(meetupWizardSource).toContain("lg:grid-cols-[minmax(0,1.12fr)_minmax(280px,0.88fr)]");
    expect(meetupWizardSource).toContain("Create club event");
    expect(meetupWizardSource).toContain("Meetup details");
    expect(meetupWizardSource).toContain("Presentation & schedule");
  });

  it("retains a responsive single-column form layout on smaller screens", () => {
    expect(meetupWizardSource).toContain("grid grid-cols-1 gap-3 sm:grid-cols-3");
    expect(meetupWizardSource).toContain("grid grid-cols-1 gap-3 sm:grid-cols-2");
  });
});
