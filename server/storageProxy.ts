/**
 * storageProxy.ts — Proxy for /manus-storage/* paths.
 * Converts storage keys to signed URLs via the Forge presign API.
 */
import type { Express } from "express";
import { logger } from "./logger.js";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    const forgeApiUrl = process.env.BUILT_IN_FORGE_API_URL;
    const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY;

    if (!forgeApiUrl || !forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        logger.error("storage_proxy_backend_failed", { status: forgeResp.status });
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      // Cache stockfish WASM files aggressively (they never change)
      if (key.endsWith(".wasm") || key.endsWith(".js")) {
        res.set("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        res.set("Cache-Control", "no-store");
      }
      res.redirect(307, url);
    } catch (err) {
      logger.error("storage_proxy_fetch_failed", { error: err });
      res.status(502).send("Storage proxy error");
    }
  });
}
