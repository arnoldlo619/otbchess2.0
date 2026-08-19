# Stripe Tournament Payments Audit

## Executive assessment

**Tournament-fee payment infrastructure is not built yet.** ChessOTB has a functioning Stripe code path for **ChessOTB Pro subscriptions**, but not for club-owner event fees, registration checkout, connected-account onboarding, refunds, payouts, or payment reconciliation.

The Stripe capability is now enabled for the project’s managed environment. The remaining gap is a new payments domain, not a small extension of the existing subscription route.

| Capability | Current state | Evidence |
|---|---|---|
| Pro subscription Checkout | Present | `server/billing.ts` creates Checkout Sessions in `subscription` mode using monthly or annual platform price IDs. |
| Subscription webhooks | Present | The existing webhook toggles `users.isPro` and stores the customer ID. |
| Club owner Stripe onboarding | Missing | Club payment settings show a non-wired **Connect Stripe Account** control. |
| Tournament or RSVP payment Checkout | Missing | No server checkout route accepts an event, tournament, registration, or amount. |
| Fee enforcement before registration | Missing | Event RSVP and tournament registration do not inspect a paid payment state. |
| Payment persistence | Missing | No payment, Checkout Session, refund, payout, or connected-account table exists. |
| Refunds and reconciliation | Missing | No owner transaction history or server-side refund controls exist. |
| Prize distribution | Placeholder only | The club dashboard visualizes percentages but has no payout implementation. |

## Current implementation boundaries

The current billing router is explicitly scoped to Pro subscriptions. It hard-codes `mode: "subscription"`, accepts only monthly or annual plans, redirects to `/pro/success`, and handles subscription lifecycle events. It cannot safely be reused for a one-time tournament registration payment without a separate payment purpose and webhook fulfillment path.

The club owner **Payments** sub-tab is currently a forward-looking UI shell. Its buy-in inputs are disabled, the connection control has no action, and the transaction history and prize distribution sections are non-operational. The event schema has a display-oriented `entryFee` string, but no canonical minor-unit fee amount, currency, payment requirement, checkout session ID, payment intent ID, refund state, or registration-payment relationship.

## Recommended first release

The smallest safe release is **paid registration for a specific club event or linked tournament**, using Stripe Checkout in one-time `payment` mode.

1. A club owner enables a paid fee on an event, enters a non-zero amount and USD currency, and chooses whether payment is required before RSVP/registration is confirmed.
2. A player starts an authenticated Stripe Checkout Session tied to exactly one registration attempt.
3. Only the signed Stripe webhook marks the registration paid. The client-side success return is informational and never grants access by itself.
4. The owner sees payment status, Checkout/Payment Intent reference, cash overrides, refunds, and a reconciliation export.
5. Duplicate registrations and duplicate Checkout Sessions are prevented with a server-side idempotency key and a unique business key of event plus registrant.

This release should **not** auto-distribute prize pools. Prize payouts require a separate policy, winner review workflow, tax and identity handling, and a clear Stripe Connect model.

## Required data model

| Record | Essential fields | Why local storage is justified |
|---|---|---|
| Club payment account | `clubId`, `stripeAccountId`, `onboardingStatus` | Connect account reference and business authorization state. |
| Event payment configuration | `eventId`, `amountMinor`, `currency`, `paymentRequired`, `stripePriceId` or dynamic-price policy | Event-specific business policy not held by Stripe. |
| Registration payment | `eventId`, `registrantId`, `stripeCheckoutSessionId`, `stripePaymentIntentId`, `state`, `createdAt`, `paidAt` | Links Stripe payment evidence to the ChessOTB registration fulfillment state. |
| Refund operation | `registrationPaymentId`, `stripeRefundId`, `requestedBy`, `reason`, `createdAt` | Required owner operational audit trail. |

Never store card numbers, card expiry, CVV, raw webhook payloads, Checkout URLs, client secrets, or duplicated Stripe payment amounts/statuses beyond the minimal fulfillment and audit fields above.

## Architecture decision

The destination of collected money determines the design:

| Option | Payment flow | Recommended use |
|---|---|---|
| **A. Platform collection, manual club settlement** | ChessOTB’s Stripe account receives entry fees; staff settles clubs outside the product. | Not recommended beyond a controlled pilot because it creates manual operations and platform liability. |
| **B. Stripe Connect direct charges** | Each club completes Stripe Connect onboarding; club receives event fees directly while ChessOTB may collect an application fee. | **Selected and recommended** for a multi-club product. |
| **C. Club uses a hosted external link** | ChessOTB records payment instruction/link but does not collect or verify Stripe payments. | Fastest interim option, but no automatic payment-gated registration. |

## Confirmed launch recommendation

Use **Stripe Connect direct charges**, with each club acting as the merchant for its own tournament fees. This is the strongest fit for ChessOTB’s marketplace-style operating model because the customer payment is made directly to the connected club account. Stripe’s current guidance describes direct charges as transactions between connected accounts and their customers, with payment and application fees flowing from the connected account. It also recommends assigning connected-account negative-balance responsibility to Stripe for this model.[1]

For a new integration, use Stripe’s current Accounts v2 model with a merchant configuration where supported, Stripe-hosted onboarding, and Stripe-hosted Checkout. Do not start with prize payouts, pooled funds, or multiple-recipient split payments. Those workflows introduce platform fund custody, chargeback recovery, operational support, and regulatory complexity that are unnecessary for paid registration.

The first release should be **USD, one club, one event, one registration, one payment**. ChessOTB should initially set a zero application fee while the payment flow is proven, then introduce an explicit per-transaction or percentage platform fee once refund/support operations are established.

## Recommended delivery sequence

| Phase | Scope | Outcome |
|---|---|---|
| 1 | Stripe Connect onboarding and club payment account status | Owners can securely connect a direct-charge merchant account. |
| 2 | Event fee configuration and one-time Checkout | Paid events initiate secure registration checkout. |
| 3 | Signed webhook fulfillment and registration gating | Only paid players receive confirmed event/tournament registration. |
| 4 | Owner reconciliation, cash overrides, refunds, receipts | Clubs can operate payments day to day. |
| 5 | Optional platform fee and prize-payout policy | Adds monetization and payout controls after the core flow is proven. |

## Explicit non-goals for launch

- Automatic prize-pool distribution or winner payouts.
- Multi-club or multi-recipient split payments.
- Stored payment methods, subscriptions, or in-app card entry for tournament registration.
- Client-side payment confirmation as a registration authority.

## Current blocker

The project Stripe sandbox must be claimed before end-to-end testing. The payment destination model also needs confirmation before any Stripe Connect accounts, financial flows, or fee policies are implemented.

## References

[1]: https://docs.stripe.com/connect/integration-recommendations "Stripe Connect recommended integrations and charge types"
