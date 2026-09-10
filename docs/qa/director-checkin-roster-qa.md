# Director Check-in Roster QA

## Refinement scope — 2026-09-10

The registration-phase Check-in Roster previously used an independent flex layout for headers and player rows. Its fixed-width status, rating, payment, and action controls did not share a reliable alignment contract, which allowed the table to feel uneven as dual ELO values and stacked payment controls appeared.

The desktop roster now uses the same six-column CSS grid for the header and each player row: check-in/rank, player identity, check-in status, rating, payment methods, and actions. The layout activates at the tablet breakpoint; the existing mobile card pattern remains available below that width so operational controls do not compress into a narrow table.

Status now includes a compact text-and-dot state treatment, ratings use tabular numeric labels for Rapid and Blitz data, and payment methods are paired compact action segments with Lucide banknote and card icons plus `aria-pressed` state. The surrounding payment counts and summary use the same icon language.

## Validation

- Focused Director console coverage: 44 passing tests, including new source contracts for shared desktop grid columns, tablet/mobile fallback, rating labels, and accessible payment controls.
- TypeScript: passed with zero errors.
- Changed-file ESLint: zero errors; six existing unused-variable warnings remain in `Director.tsx`.
- Project lint: zero errors.
- Full suite: 6,926 passing; 13 unrelated existing failures remain in accessibility-overlay, native-form-label, and Tournament Wizard payment-toggle source-contract suites.
- Clean development-server restart: passed.

## Visual review boundary

The connected Director demo currently resumes a completed Quads state, while its fresh reload remains on the shared loading screen. It does not expose the registration-phase roster without changing tournament state. No player, check-in, or payment data was modified for this QA pass; responsive behavior and alignment are protected by the rendered layout architecture and focused source contracts.
