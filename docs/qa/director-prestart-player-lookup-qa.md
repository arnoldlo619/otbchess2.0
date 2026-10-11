# Tournament Director pre-start player lookup QA

**Date:** 2026-10-10  
**Scope:** Tournament Director → Players tab, before the tournament begins (Round 0)

## Delivered behavior

- During **registration / Round 0**, the roster toolbar now presents a labeled **Add player** Chess.com username lookup instead of the generic player search field.
- Lookup retains the trusted existing Chess.com proxy, response normalization, transient retry behavior, duplicate-user protection, pairing-rating selection, and avatar/rating preview.
- A successful lookup is intentionally two-step: **Look up** resolves the player, then **Add player** confirms roster insertion.
- The existing Add Player modal remains reachable as **Other methods** for Lichess, manual, and CSV registration; those workflows are not duplicated or removed.
- Once the tournament begins, the same location returns to the existing **Search name, username, ELO…** roster search. The Players tab no longer exposes late registration.
- The existing Round-1 late walk-in pathway remains available from the **Home** dashboard and retains its pairing/bye safeguards.

## Accessibility and responsive checks

- Explicit visible label plus linked username input.
- Native form submission supports Enter for lookup, then confirmation after a result is found.
- Lookup errors are exposed through `role="alert"`; resolved player feedback uses `aria-live="polite"`.
- Duplicate names are rejected before any profile request.
- Input and action controls have explicit 44px minimum touch targets.
- The parent roster row stacks vertically before the `sm` breakpoint; the lookup surface uses full width with a shrink-safe input, preventing horizontal overflow on narrow screens.

## Automated validation

| Check | Result |
| --- | --- |
| Focused Director / player lookup suites | **92 passed** across 8 files |
| TypeScript | `pnpm exec tsc --noEmit` passed |
| Changed-file ESLint | 0 errors; 6 established `Director.tsx` warnings only |
| Project ESLint | 0 errors; 233 established warnings |
| Production build | `pnpm run build` passed |
| Diff integrity | `git diff --check` passed |
| Local route health | Director demo/manage and access routes returned HTTP 200 |
| Public route health | Demo tournament/manage and player routes returned HTTP 200 |

## Browser QA

- Seeded a local Round-0 Director fixture and opened the Players tab.
- Confirmed the toolbar shows **Add player**, a Chess.com username field, **Look up**, profile helper text, and the secondary **Other methods** action.
- Verified no horizontal overflow; the lookup surface measured 576px inside a 934px roster toolbar, and the username input computed to 44px minimum height.
- Ran a live `hikaru` lookup through the production proxy. The interface rendered the returned profile image, GM title, Rapid/Blitz ratings, and changed the action to **Add player**.
- Confirmed the add action inserted Hikaru into the roster, updated the counter from `0/0` to `1/1`, reset/focused the lookup input, and showed the success toast.
- Opened the active demo tournament’s Players tab (Round 5) and confirmed it shows only the normal **Search name, username, ELO…** field—no registration input or Add Player control.

## Full regression baseline

`pnpm vitest run` completed with **7,217 passed / 2 skipped / 27 known unrelated failures across 18 legacy suites**. All suites modified or directly affected by this change pass in focused validation. One representative unrelated failure remains a stale Tournament Wizard payment-toggle source contract.
