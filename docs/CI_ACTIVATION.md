# ChessOTB GitHub Actions Activation

The verified CI definition is preserved in [`CI_WORKFLOW_TEMPLATE.yml`](./CI_WORKFLOW_TEMPLATE.yml). The currently connected GitHub App token can push normal source files but GitHub rejects any push that creates or updates `.github/workflows/*` because the token lacks workflow permission.

## Activate the workflow

Use one of these owner-authorized methods:

| Method | Steps |
|---|---|
| GitHub web editor | In `arnoldlo619/otbchess2.0`, create `.github/workflows/ci.yml`, copy the template verbatim, and commit to `main`. |
| Reconnected GitHub credential | Reconnect GitHub with workflow permission, copy `docs/CI_WORKFLOW_TEMPLATE.yml` to `.github/workflows/ci.yml`, remove the workflow ignore rule, checkpoint, and push. |

After activation, confirm the workflow registers under **Actions** and that the same `main` SHA passes TypeScript, ESLint, internal-link validation, unit tests, production build, and bundle-budget enforcement. Until that run is green, the repository has a documented CI design but not an active CI gate.
