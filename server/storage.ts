// Managed object-storage helpers for user-uploaded media.
// Uploads use the platform Forge API to obtain a presigned S3 PUT URL.

function getForgeConfig() {
  const forgeUrl = process.env.BUILT_IN_FORGE_API_URL;
  const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;

  if (!forgeUrl || !forgeKey) {
    throw new Error("Storage configuration is unavailable");
  }

  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

function normalizeKey(relativeKey: string): string {
  return relativeKey.replace(/^\/+/, "");
}

function appendHashSuffix(relativeKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relativeKey.lastIndexOf(".");
  if (lastDot === -1) return `${relativeKey}_${hash}`;
  return `${relativeKey.slice(0, lastDot)}_${hash}${relativeKey.slice(lastDot)}`;
}

export async function storagePut(
  relativeKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relativeKey));
  const presignUrl = new URL("v1/storage/presign/put", `${forgeUrl}/`);
  presignUrl.searchParams.set("path", key);

  const presignResponse = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });
  if (!presignResponse.ok) {
    throw new Error(`Storage upload authorization failed (${presignResponse.status})`);
  }

  const { url: signedUrl } = (await presignResponse.json()) as { url?: string };
  if (!signedUrl) throw new Error("Storage upload authorization returned no URL");

  const body = typeof data === "string"
    ? new Blob([data], { type: contentType })
    : new Blob([data as BlobPart], { type: contentType });
  const uploadResponse = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  if (!uploadResponse.ok) {
    throw new Error(`Storage upload failed (${uploadResponse.status})`);
  }

  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relativeKey: string): Promise<string> {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = normalizeKey(relativeKey);
  const getUrl = new URL("v1/storage/presign/get", `${forgeUrl}/`);
  getUrl.searchParams.set("path", key);

  const response = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });
  if (!response.ok) {
    throw new Error(`Storage download authorization failed (${response.status})`);
  }

  const { url } = (await response.json()) as { url?: string };
  if (!url) throw new Error("Storage download authorization returned no URL");
  return url;
}
