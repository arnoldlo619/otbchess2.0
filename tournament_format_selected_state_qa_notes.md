# Tournament Format Selected State QA

## Verification

The Quickstart option advanced correctly into its existing setup flow after selection. The selected-card implementation applies an `aria-pressed` state, a contrasting forest-green border, a one-time pulse glow, and a 220 ms confirmation interval before the selected format advances. The effect uses a reduced-motion fallback that keeps the solid state without animating.

## Scope

The enhancement does not alter format defaults or the downstream Quickstart, Quads, Large Event, or Schedule flows. It only adds visible selection feedback at the point where the format is chosen.
