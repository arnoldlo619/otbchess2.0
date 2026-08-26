# ChessOTB GitHub Actions Activation

The verified CI definition is active at [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) and is preserved in [`CI_WORKFLOW_TEMPLATE.yml`](./CI_WORKFLOW_TEMPLATE.yml). The connected GitHub App token can push normal source files but GitHub rejects any push that creates or updates `.github/workflows/*` because the token lacks workflow permission.

## Verified activation

On August 26, 2026, an owner-authorized GitHub web-editor commit activated the workflow. The successful [Quality Gates run `32916972360`](https://github.com/arnoldlo619/otbchess2.0/actions/runs/32916972360) completed TypeScript, ESLint, internal-link validation, 6,770 deterministic unit/integration tests, the production build, and bundle-budget enforcement. Browser E2E specifications and live SMTP/Lichess credential probes are intentionally excluded from deterministic CI and remain separately authorized checks.

## Future workflow changes

Use one of these owner-authorized methods:

| Method | Steps |
|---|---|
| GitHub web editor | In `arnoldlo619/otbchess2.0`, create `.github/workflows/ci.yml`, copy the template verbatim, and commit to `main`. |
| Reconnected GitHub credential | Reconnect GitHub with workflow permission, copy `docs/CI_WORKFLOW_TEMPLATE.yml` to `.github/workflows/ci.yml`, remove the workflow ignore rule, checkpoint, and push. |

For every future workflow change, confirm the workflow registers under **Actions** and that the same `main` SHA passes TypeScript, ESLint, internal-link validation, unit tests, production build, and bundle-budget enforcement.
