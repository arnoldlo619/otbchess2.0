# Tournament Payment Validation and Player Preview QA

## Live Quickstart verification

An invalid Venmo handle (`@chessotb`) immediately produced a visible validation notice explaining that a complete secure Venmo URL is required. The configuration continuation is programmatically gated by the same validator.

Replacing it with `https://venmo.com/chessotb` cleared the warning and updated the host preview in place. The preview rendered the same player-facing **Pay entry fee** card with a Venmo action that the registration confirmation flow uses. The payment methods remain optional, so hosts can proceed with no methods configured.

## Scope

The shared player payment card supports individual Venmo, Cash App, and PayPal links, each with its matching QR image when configured. External player actions use a safe new-tab link with `rel="noreferrer"`.
