import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApiErrorNotice } from "./ApiErrorNotice";
import { ApiError } from "@/lib/apiFetch";

describe("ApiErrorNotice", () => {
  it("renders friendly server-error copy and a support reference", () => {
    const html = renderToStaticMarkup(
      <ApiErrorNotice
        error={new ApiError({
          message: "We couldn’t complete that request. Please try again.",
          status: 500,
          code: "INTERNAL_SERVER_ERROR",
          requestId: "req-ui-123",
          retryable: true,
        })}
        title="Profile changes weren’t saved"
        onRetry={() => undefined}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Profile changes weren’t saved");
    expect(html).toContain("We couldn’t complete that request. Please try again.");
    expect(html).toContain("Reference: req-ui-123");
    expect(html).toContain("Retry");
  });

  it("does not expose internal server details", () => {
    const html = renderToStaticMarkup(
      <ApiErrorNotice error={new ApiError({ message: "Safe user-facing message", status: 500 })} />,
    );
    expect(html).not.toContain("stack");
    expect(html).not.toContain("database password");
  });
});

