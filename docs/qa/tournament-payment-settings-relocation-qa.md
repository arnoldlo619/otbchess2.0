# Tournament Payment Settings Relocation QA

## Wizard removal

On the live Tournament Wizard Quickstart view, the form contains tournament details and tournament settings only. Neither **Optional entry payment links** nor **Player payment order and instructions** appears in the creation path, leaving payment setup to the Director Settings surface after a tournament exists.

## Director Settings configuration

The reusable Director Settings panel retains Venmo, Cash App, and PayPal secure-link validation; accessible enable/disable switches; QR image upload, replacement, and removal; keyboard-accessible method reordering; optional player instructions; and the existing player registration preview. The focused rendered control test verifies the configuration panel, validation feedback, QR input labelling, preview, and toggle updates. The wizard source contracts verify both former payment sections and payment-driven creation gating are absent.

## Responsive and quality checks

The mobile landing review confirmed the host entry surface remains compact and touch-safe. The focused relocation suite passed 22 tests, alongside TypeScript, zero-error changed-file lint, and whitespace integrity. TournamentWizard retains 11 advisory lint warnings that predate this move; no new lint errors were introduced.
