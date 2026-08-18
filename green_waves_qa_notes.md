# Green Waves QA Notes

- The representative public club dashboard loaded successfully after the development-server restart.
- The selected background state cannot be changed in the sandbox browser because the seeded club is not owned by the active session; no club data was mutated for visual testing.
- Green Waves is verified through the background picker’s accessible selection contract, the dashboard and public-hero render contracts, TypeScript, and focused Vitest coverage.
- The implementation follows the supplied shader brief with a zero-dependency WebGL canvas, a pixel budget, page-visibility and intersection pausing, context cleanup, and a static frame for `prefers-reduced-motion`.
