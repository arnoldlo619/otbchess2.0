# Mobile Navigation Reference Findings

## Scope

Reference research for the Club Dashboard mobile navigation refinement approved on 2026-09-21. The implementation retains ChessOTB’s existing brand, icon family, account controls, and club permissions; the references inform information architecture and interaction hierarchy only.

## Findings

The strongest relevant patterns use a compact top-level control rather than asking users to scan a dense footer. The [ClickUp workspace screen](https://mobbin.com/screens/d9ff90b4-29aa-4618-841d-b4416c721316) demonstrates a compact workspace header, clear primary actions, and a bottom sheet that groups actions by purpose. The [Fabric workspace screen](https://mobbin.com/screens/4020b3dd-ac0b-4fc0-939e-d6bbae3a065d) illustrates that a small fixed control cluster can be visually calm when hierarchy is expressed by spacing and a single dominant trigger. The [Photoroom workspace screen](https://mobbin.com/screens/2c632fcb-7da7-4fea-abe0-bc8ed77c96d5) reinforces strong destination labels and clear grouping for workspace tools.

For ChessOTB, the appropriate adaptation is a single 44px header hamburger control that opens one focused, right-edge drawer. The drawer should group the universally available club destinations first, then owner/director-only workspace tools and the existing Join Club QR action. It should retain icon-plus-label navigation, explicit active state, a dimmed backdrop, Escape and backdrop dismissal, and focus restoration. This avoids mixing a dense primary footer bar with a second owner-only bottom sheet.

## Implementation constraints

The mobile drawer must use the current ChessOTB green/nav tint tokens, current icon family, `touchAction: "manipulation"`, 44px minimum controls, safe-area padding, visible keyboard focus, and reduced-motion fallbacks. Desktop Club Dashboard navigation remains unchanged.
