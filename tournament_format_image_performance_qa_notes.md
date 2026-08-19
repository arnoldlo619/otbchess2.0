# Tournament Format Card Image Performance QA

## Delivery optimization

The four original supplied PNG illustrations totaled approximately **11.6 MB**. They are now delivered as 960px WebP assets totaling approximately **322 KB**, reducing the initial illustration payload by roughly **97%** while retaining the existing illustration composition in the 3:2 card frame.

## Rendering behavior

The live format selector rendered all four cards with their artwork visible and stable. Each image is eagerly requested, asynchronously decoded, and pre-decoded once the selector mounts. A warm paper placeholder is shown only until the browser finishes decoding, then fades into the image. The placeholder shimmer is disabled for motion-sensitive users.
