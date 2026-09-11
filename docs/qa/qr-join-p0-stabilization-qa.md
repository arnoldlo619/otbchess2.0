# QR Join P0 Stabilization QA

## Browser findings

On September 11, 2026, a 375px local-preview visit to an invalid QR deep link rendered a visible recovery card with **Try again** and **Enter code manually** actions. It did not produce an empty page.

A final paired 375px capture reconfirmed both outcomes after the cache-namespace rotation: the valid persisted invite rendered the tournament title, format, date, time control, and complete registration form; the unresolved invite rendered the retry/manual-code recovery card. Neither route was blank or horizontally overflowing.

A read-only browser visit to the persisted invite route `/join/WDWC4BQH` initially presented the non-lazy QR entry loading shell, then resolved to the **quick 1 2 3** tournament join form with its format, date, and time-control context. The user was not registered and no tournament data was changed.

## Endpoint verification

The persisted invite resolver returned HTTP 200 with `Cache-Control: no-store, max-age=0` and the canonical tournament identifier. The participant live-state endpoint returned HTTP 200 with the same no-store policy. These checks were read-only.

## Validation boundary

Focused QR reliability and SSE tests passed after the P0 implementation. Full-suite failures are limited to the existing accessibility-overlay, form-label, and Tournament Wizard payment-toggle source-contract suites; the QR reliability suite passed.
