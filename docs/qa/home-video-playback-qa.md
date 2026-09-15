# Chess.com Integration Background Video QA

## Initial production investigation

- The public Home page loaded successfully in the connected browser on September 15, 2026.
- The affected Chess.com Integration section is implemented as a muted autoplaying YouTube iframe background under a theme-specific visual overlay.
- The supplied production screenshot and current component configuration establish a visibility/playback issue requiring a first-party fallback rather than relying exclusively on the third-party embedded player.

## External source check

The configured clip, [ChessOTB SD Tournament](https://www.youtube.com/watch?v=KEi0wr1vRG8), remained publicly available through YouTube’s oEmbed response on September 15, 2026. Both the standard YouTube embed and the privacy-enhanced `youtube-nocookie.com` embed returned HTTP 200. The repair therefore does not replace an unavailable video; it removes a fragile dependency on third-party cookies and a heavily opaque, always-loaded embed.

The Home section now loads the privacy-enhanced embed only after the section enters the viewport, requests muted inline looping playback, exposes a non-interactive player, and fades it in after the embed loads. An accessible neutral visual fallback and a poster frame remain visible when the external player is blocked, unavailable, or still loading.

## Local browser observation

The refreshed local Home route reached the Chess.com Integration anchor successfully after restart and retained its regular textual content. Browser capture cannot establish motion from a single frame, but the repaired section presents a deliberate visual fallback rather than a blank or failed media frame while the third-party player initializes.

A full-page local capture showed visible tournament footage in the Chess.com Integration section under the revised, lower-opacity overlay. The heading, explanatory copy, username input, and primary action remained readable above the media treatment.

## Validation

The focused Home visual suite passed four assertions covering the privacy-enhanced muted-inline autoplay configuration, in-view loading, fade-in behavior, and visible fallback poster. TypeScript and changed-file lint completed without errors. Project lint completed without errors, and the full suite completed with 6,952 passing tests and 16 pre-existing failures across unrelated accessibility overlay, Club Dashboard form-label, and historical Wizard source-contract suites. The browser console and observed network log contained no new Home video errors; cross-origin iframe subrequests are not represented in the local development network log.
