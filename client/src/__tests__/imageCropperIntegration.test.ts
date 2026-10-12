import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const cropper = source("client/src/components/ImageCropDialog.tsx");
const avatarCropper = source("client/src/components/AvatarCropModal.tsx");
const clubAvatar = source("client/src/components/ClubAvatarUpload.tsx");
const clubBanner = source("client/src/components/ClubBannerUpload.tsx");
const accountMenu = source("client/src/components/AvatarNavDropdown.tsx");
const clubDashboard = source("client/src/pages/ClubDashboard.tsx");
const clubProfile = source("client/src/pages/ClubProfile.tsx");
const tournamentWizard = source("client/src/components/TournamentWizard.tsx");
const meetupWizard = source("client/src/components/ClubMeetupWizard.tsx");
const rsvpBuilder = source("client/src/pages/RsvpFormBuilderPage.tsx");

describe("platform image crop controls", () => {
  it("provides one accessible drag-and-scale editor with output-size controls", () => {
    expect(existsSync(resolve(process.cwd(), "client/src/components/ImageCropDialog.tsx"))).toBe(true);
    expect(cropper).toContain('import Cropper from "react-easy-crop"');
    expect(cropper).toContain("aspect={aspect}");
    expect(cropper).toContain('aria-label="Image scale"');
    expect(cropper).toContain("onCropChange={setCrop}");
    expect(cropper).toContain("onZoomChange={setZoom}");
    expect(cropper).toContain("renderCroppedImage");
    expect(cropper).toContain("maxDataUrlLength");
    expect(cropper).toContain("Drag to position your image");
    expect(cropper).toContain('overlayClassName="z-[290]"');
    expect(cropper).toContain('className="z-[300]');
  });

  it("uses the shared editor for every primary identity and fixed-frame cover surface", () => {
    expect(avatarCropper).toContain("<ImageCropDialog");
    expect(clubAvatar).toContain("<ImageCropDialog");
    expect(clubAvatar).toContain('title="Crop club logo"');
    expect(clubBanner).toContain("<ImageCropDialog");
    expect(clubBanner).toContain('title="Crop club banner"');
    expect(accountMenu).toContain("<AvatarCropModal");
    expect(clubDashboard).toContain("<ImageCropDialog");
    expect(clubProfile).toContain("<ImageCropDialog");
    expect(clubProfile).toContain('title="Crop event cover"');
    expect(tournamentWizard).toContain('title="Crop tournament cover"');
    const onboardingSource = tournamentWizard.slice(
      tournamentWizard.indexOf("function SegmentedOnboardingStep"),
      tournamentWizard.indexOf("// ─── Step 1: Details")
    );
    expect(onboardingSource).toContain('title="Crop tournament cover"');
    expect(onboardingSource).toContain('aria-label="Upload tournament cover"');
    expect(meetupWizard).toContain('title="Crop meetup cover"');
    expect(rsvpBuilder).toContain('title="Crop RSVP header"');
  });

  it("keeps user-directed crop dimensions aligned to each destination", () => {
    expect(clubAvatar).toContain("width: OUTPUT_SIZE, height: OUTPUT_SIZE");
    expect(clubBanner).toContain("width: BANNER_WIDTH, height: BANNER_HEIGHT");
    expect(clubDashboard).toContain("width: 1920, height: 480");
    expect(clubProfile).toContain("width: 1200, height: 675");
    expect(tournamentWizard).toContain("width: 1200, height: 675");
    expect(meetupWizard).toContain("width: 1200, height: 675");
    expect(rsvpBuilder).toContain("width: 1280, height: 400");
  });
});
