# Tournament Payment QR Upload QA

## Live configuration verification

The Quickstart configuration displayed three independent upload controls immediately below the Venmo, Cash App, and PayPal text fields: **Upload Venmo QR**, **Upload Cash App QR**, and **Upload PayPal QR**. The controls fit the existing three-column payment-link layout without interfering with the required tournament inputs or Quickstart defaults.

## Upload behavior

Each control accepts PNG, JPEG, and WebP files up to 1.5 MB. After reading a supported image, the method-specific control renders an accessible image preview with replace and remove actions. The corresponding data URL persists with the tournament configuration, independently for all three methods. The same component is used in the Schedule configuration flow.
