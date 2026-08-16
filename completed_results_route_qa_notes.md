# Completed Tournament Results Routing QA

The completed-tournament Director action row previously sent **View Results** to `/tournament/:id/overview`, which is the overview page containing a secondary Full Report control. The direct action now targets `/tournament/:id/report`, the full player-report route. The live demo director dashboard is currently in progress, so its completed-only action row is not rendered; the source-level regression test verifies the exact completed action destination.
