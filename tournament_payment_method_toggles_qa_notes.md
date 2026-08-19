# Tournament Payment Method Toggles QA

## Live Quickstart verification

The post-preview Quickstart configuration now renders independent accessible switches for Venmo, Cash App, and PayPal. Each starts enabled and exposes its current state through the switch role.

Venmo was toggled off in the live wizard. Its control changed from **Enabled** to **Disabled**, adopted the muted switch state, and reduced the related payment column emphasis. Cash App and PayPal remained enabled, confirming independent method state rather than a global payment setting.

## Player-facing behavior

Disabled methods are omitted from both the host registration preview and the shared player registration payment card. Legacy tournaments without an enabled-state field remain compatible because the default behavior is enabled.
