# Tournament Payment Instructions and Method Priority QA

## Live Quickstart verification

The post-preview Quickstart form now presents a dedicated **Player payment order and instructions** section after the payment links and player registration preview. It includes three distinct drag-handle cards for Venmo, Cash App, and PayPal, with each card showing its current enabled state and a clear drag affordance.

An optional payment-instructions textarea sits directly beneath the prioritization controls with a USCF ID/tournament-name example. The section is visually secondary to payment-link entry but remains large enough to use comfortably and appears before general tournament settings.

## Behavior verified by contracts

The order uses pointer and keyboard sortable sensors, normalizes legacy tournament configurations to the default order, persists the order and note, and sends both to the shared player registration payment card. Disabled methods remain excluded from the player-facing order.
