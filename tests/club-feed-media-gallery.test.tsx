// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ClubFeedMediaGallery } from "../client/src/components/club/ClubFeedMediaGallery";

const images = [
  { id: "image-1", url: "/api/clubs/club-1/feed/post-1/attachments/image-1/file", fileName: "board-one.webp", mimeType: "image/webp" },
  { id: "image-2", url: "/api/clubs/club-1/feed/post-1/attachments/image-2/file", fileName: "team-photo.gif", mimeType: "image/gif" },
];

afterEach(cleanup);

describe("ClubFeedMediaGallery", () => {
  it("opens at the requested image and navigates with named controls and thumbnails", async () => {
    const user = userEvent.setup();
    render(<ClubFeedMediaGallery images={images} initialIndex={1} open onOpenChange={() => {}} />);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("img", { name: "team-photo.gif" })).toBeTruthy();
    expect(screen.getByText("2 of 2")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Previous image" }));
    expect(screen.getByRole("img", { name: "board-one.webp" })).toBeTruthy();
    expect(screen.getByText("1 of 2")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "View team-photo.gif" }));
    expect(screen.getByRole("img", { name: "team-photo.gif" })).toBeTruthy();
  });

  it("exposes a named close action that delegates modal state to its parent", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ClubFeedMediaGallery images={images} initialIndex={0} open onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Close gallery" }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

});
