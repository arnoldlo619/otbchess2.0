export function buildPreservedRedirect(path: string, search = "", hash = ""): string {
  const normalizedSearch = search && !search.startsWith("?") ? `?${search}` : search;
  const normalizedHash = hash && !hash.startsWith("#") ? `#${hash}` : hash;
  return `${path}${normalizedSearch}${normalizedHash}`;
}

export function buildTournamentCreateRedirect(search = "", hash = ""): string {
  const params = new URLSearchParams(search);
  params.set("action", "create");
  const query = params.toString();
  return buildPreservedRedirect("/", query ? `?${query}` : "", hash);
}

export function stripCreateAction(search = "", hash = ""): string {
  const params = new URLSearchParams(search);
  params.delete("action");
  const query = params.toString();
  return buildPreservedRedirect("/", query ? `?${query}` : "", hash);
}
