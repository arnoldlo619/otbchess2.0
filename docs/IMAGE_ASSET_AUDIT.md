# Principal Image Asset Audit

**Audit date:** 2026-08-22

The principal-route browser audit identified two shared branding PNGs delivered far above their rendered dimensions. The exclamation logo was **1536×1024 / 2.2 MiB** while commonly rendered at 32–64 px. The ChessOTB wordmark was **2752×1536 / 5.7 MiB** while rendered near 57×32 px in Join and navigation contexts.

Deterministic, aspect-ratio-preserving WebP variants were created and visually verified with transparency and artwork intact:

| Asset | Optimized dimensions | Optimized size |
|---|---:|---:|
| Exclamation logo | 256×171 | 8.3 KiB |
| ChessOTB wordmark | 320×179 | 12.7 KiB |

No crop, semantic edit, color change, or reconstruction was applied.

The landing route also exposed three screenshot assets above the 3× rendered-dimension threshold. Responsive WebP variants preserve the full source aspect ratio and interface content:

| Landing screenshot | Original | Responsive variant | Result |
|---|---:|---:|---|
| QR projection | 2048×1076 / 56 KiB | 1240×651 / 37.6 KiB | Visually verified |
| Player signup confirmation | 1014×2048 / 44 KiB | 600×1212 / 30.0 KiB | Visually verified |
| EXIT Gallery phone capture | 1179×1922 / 508 KiB | 600×978 / 28.4 KiB | Visually verified |

Mobile validation identified two final width outliers. The QR projection was reduced again to **720×378 / 18.4 KiB**, and the league bracket screenshot was reduced from **1704×959 / 296 KiB** to a visually verified **720×405 / 13.7 KiB** WebP. Both remain sufficient for their largest desktop render while staying below the 3× rendered-dimension budget on mobile.

`e2e/principal-image-performance.spec.ts` now enforces both conditions across nine principal routes at desktop and mobile widths: images below 1.25 viewports must use native lazy loading, and loaded images above 512 source pixels may not exceed 3× their rendered dimensions. All **18 route/viewport checks pass**.
