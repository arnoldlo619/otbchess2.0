// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiCreateClubFeedPost: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("../client/src/lib/clubFeedApi", () => ({
  apiCreateClubFeedPost: mocks.apiCreateClubFeedPost,
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess },
}));

vi.mock("../client/src/components/PlayerAvatar", () => ({
  PlayerAvatar: ({ name }: { name: string }) => <div aria-label={`${name} avatar`} />,
}));

import { ClubFeedComposer } from "../client/src/components/club/ClubFeedComposer";

const onPublished = vi.fn();

function renderComposer(openRequest = 0) {
  return render(
    <ClubFeedComposer
      clubId="club-1"
      actorName="Member One"
      actorAvatarUrl={null}
      accent="#4CAF50"
      isDark
      openRequest={openRequest}
      onPublished={onPublished}
    />,
  );
}

function composerTextarea() {
  return screen.getByRole("textbox", { name: "Post an announcement" }) as HTMLTextAreaElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.apiCreateClubFeedPost.mockResolvedValue({ id: "feed-1" });
  onPublished.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ClubFeedComposer", () => {
  it("expands from the compact input and resets its state with Discard or Escape", async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(screen.getByPlaceholderText("Share an update with your club…"));
    const textarea = composerTextarea();
    expect(screen.getByRole("toolbar", { name: "Club post formatting" })).toBeTruthy();

    await user.type(textarea, "Friday night blitz is open.");
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect((screen.getByPlaceholderText("Share an update with your club…") as HTMLInputElement).value).toBe("");

    await user.click(screen.getByPlaceholderText("Share an update with your club…"));
    await user.type(composerTextarea(), "Reset this with Escape.");
    await user.keyboard("{Escape}");
    expect((screen.getByPlaceholderText("Share an update with your club…") as HTMLInputElement).value).toBe("");
  });

  it("opens and focuses when the parent requests the workspace composer action", async () => {
    const { rerender } = renderComposer();

    rerender(
      <ClubFeedComposer
        clubId="club-1"
        actorName="Member One"
        accent="#4CAF50"
        isDark
        openRequest={1}
        onPublished={onPublished}
      />,
    );

    const textarea = composerTextarea();
    await waitFor(() => expect(document.activeElement).toBe(textarea));
  });

  it("submits a persisted Feed post, clears the composer, and refreshes the parent timeline", async () => {
    const user = userEvent.setup();
    renderComposer(1);

    await user.type(composerTextarea(), "The club is meeting Friday.");
    await user.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() => expect(mocks.apiCreateClubFeedPost).toHaveBeenCalledWith("club-1", expect.objectContaining({
      type: "announcement",
      actorName: "Member One",
      detail: "The club is meeting Friday.",
      attachments: [],
    })));
    await waitFor(() => expect(onPublished).toHaveBeenCalledTimes(1));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Post published to the club feed.");
    expect((screen.getByPlaceholderText("Share an update with your club…") as HTMLInputElement).value).toBe("");
  });

  it("retains the composer and presents a recoverable error if publishing fails", async () => {
    const user = userEvent.setup();
    mocks.apiCreateClubFeedPost.mockRejectedValueOnce(new Error("Network unavailable"));
    renderComposer(1);

    await user.type(composerTextarea(), "A retained draft.");
    await user.click(screen.getByRole("button", { name: "Post" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Network unavailable");
    expect(composerTextarea().value).toBe("A retained draft.");
    expect((screen.getByRole("button", { name: "Post" }) as HTMLButtonElement).disabled).toBe(false);
    expect(onPublished).not.toHaveBeenCalled();
  });

  it("supports keyboard activation, labelled file input, attachment previews, and removal", async () => {
    const user = userEvent.setup();
    renderComposer(1);

    const input = screen.getByLabelText("Add Feed attachments") as HTMLInputElement;
    const inputClick = vi.spyOn(input, "click");
    const trigger = screen.getByRole("button", { name: "Attach" });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(inputClick).toHaveBeenCalledTimes(1);
    expect(trigger.getAttribute("aria-controls")).toBe("club-feed-attachments");
    expect(input.getAttribute("aria-describedby")).toBe("club-feed-attachment-help");

    const file = new File(["pairings"], "pairings.txt", { type: "text/plain" });
    await user.upload(input, file);
    expect(await screen.findByText("pairings.txt")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Remove pairings.txt" }));
    expect(screen.queryByText("pairings.txt")).toBeNull();
  });

  it("shows a useful error when an attachment cannot be read", async () => {
    class FailingFileReader {
      result: string | null = null;
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;
      readAsDataURL() {
        this.onerror?.(new ProgressEvent("error") as ProgressEvent<FileReader>);
      }
    }
    vi.stubGlobal("FileReader", FailingFileReader);
    renderComposer(1);

    const input = screen.getByLabelText("Add Feed attachments");
    fireEvent.change(input, { target: { files: [new File(["text"], "notes.txt", { type: "text/plain" })] } });

    expect((await screen.findByRole("alert")).textContent).toContain("Unable to prepare that attachment. Please try again.");
  });
});
