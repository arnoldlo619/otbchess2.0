/*
 * AddPlayerModal — Director can manually add a player to the tournament.
 *
 * Modes:
 *   chess.com  — enter username → auto-fetch rapid ELO from chess.com API
 *   lichess    — enter username → auto-fetch rating from Lichess API
 *   manual     — enter name + ELO directly (no API lookup)
 *   csv        — paste or drop a CSV file; preview + bulk-add valid rows
 *
 * UX: pressing Enter at any point in the single-add flow adds the player and
 * resets the form so the director can immediately type the next player.
 * Modal closes only via Cancel / ✕ / Escape.
 */

import { useState, useEffect, useRef, useCallback, DragEvent } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import {
  X,
  Search,
  User,
  Loader2,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  Upload,
  FileText,
  Download,
  ChevronRight,
  Trash2,
} from "lucide-react";
import type { Player } from "@/lib/tournamentData";

// ─── Types ────────────────────────────────────────────────────────────────────

type Platform = "chess.com" | "lichess" | "manual" | "csv";

interface LookupResult {
  name: string;
  username: string;
  elo: number;
  rapid?: number;
  blitz?: number;
  bullet?: number;
  avatar?: string;
  country?: string;
  title?: string;
}

interface CsvRow {
  /** 1-based row index in the original CSV */
  rowNum: number;
  name: string;
  username: string;
  elo: number;
  /** null = valid; string = error message */
  error: string | null;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const G = "#3D6B47";
const G_RING = "rgba(61,107,71,0.25)";
const G_BG = "rgba(61,107,71,0.08)";

// ─── ELO lookup helpers ───────────────────────────────────────────────────────

async function lookupChessCom(username: string): Promise<LookupResult> {
  const [profileRes, statsRes] = await Promise.all([
    fetch(`https://api.chess.com/pub/player/${username.toLowerCase()}`),
    fetch(`https://api.chess.com/pub/player/${username.toLowerCase()}/stats`),
  ]);
  if (!profileRes.ok) throw new Error("Player not found on chess.com");
  const profile = await profileRes.json();
  const stats = statsRes.ok ? await statsRes.json() : {};
  const rapid = stats?.chess_rapid?.last?.rating ?? 0;
  const blitz = stats?.chess_blitz?.last?.rating ?? 0;
  const bullet = stats?.chess_bullet?.last?.rating ?? 0;
  return {
    name: profile.name || profile.username,
    username: profile.username,
    rapid, blitz, bullet,
    elo: rapid || blitz || bullet || 1200,
    avatar: profile.avatar,
    country: profile.country?.split("/").pop()?.toUpperCase(),
    title: profile.title,
  };
}

async function lookupLichess(username: string): Promise<LookupResult> {
  const res = await fetch(`https://lichess.org/api/user/${username.toLowerCase()}`);
  if (!res.ok) throw new Error("Player not found on Lichess");
  const data = await res.json();
  const perfs = data.perfs ?? {};
  const elo =
    perfs.rapid?.rating ?? perfs.blitz?.rating ?? perfs.bullet?.rating ?? perfs.classical?.rating ?? 1500;
  return {
    name: data.profile?.realName || data.username,
    username: data.username,
    elo,
    country: data.profile?.country,
    title: data.title,
  };
}

// ─── CSV parser ───────────────────────────────────────────────────────────────
//
// Accepts:
//   • Comma-separated or tab-separated
//   • Optional header row (detected if first cell is non-numeric text like "name")
//   • Columns: name, username, elo  (in any order if header present)
//   • Without header: col 0 = name, col 1 = username, col 2 = elo
//
// Returns one CsvRow per data row with validation applied.

function parseCsv(raw: string, existingUsernames: string[]): CsvRow[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  // Detect delimiter
  const delim = lines[0].includes("\t") ? "\t" : ",";

  const splitRow = (line: string) =>
    line.split(delim).map((c) => c.trim().replace(/^["']|["']$/g, ""));

  // Detect header
  const firstCells = splitRow(lines[0]).map((c) => c.toLowerCase());
  let nameIdx = 0, usernameIdx = 1, eloIdx = 2;
  let dataStart = 0;

  if (
    firstCells.some((c) => ["name", "player", "fullname", "full name"].includes(c)) ||
    firstCells.some((c) => ["username", "user", "handle", "id"].includes(c)) ||
    firstCells.some((c) => ["elo", "rating", "rank"].includes(c))
  ) {
    // Header row detected — map column indices
    firstCells.forEach((c, i) => {
      if (["name", "player", "fullname", "full name"].includes(c)) nameIdx = i;
      if (["username", "user", "handle", "id"].includes(c)) usernameIdx = i;
      if (["elo", "rating", "rank"].includes(c)) eloIdx = i;
    });
    dataStart = 1;
  }

  const existingSet = new Set(existingUsernames.map((u) => u.toLowerCase()));
  const seenInBatch = new Set<string>();
  const rows: CsvRow[] = [];

  lines.slice(dataStart).forEach((line, idx) => {
    const cells = splitRow(line);
    const rowNum = dataStart + idx + 1;

    const name = cells[nameIdx]?.trim() ?? "";
    const username = cells[usernameIdx]?.trim() ?? "";
    const eloRaw = cells[eloIdx]?.trim() ?? "";
    const elo = parseInt(eloRaw, 10);

    let error: string | null = null;

    if (!name) {
      error = "Missing name";
    } else if (!username) {
      error = "Missing username";
    } else if (!eloRaw || isNaN(elo)) {
      error = "ELO must be a number";
    } else if (elo < 100 || elo > 3500) {
      error = `ELO ${elo} out of range (100–3500)`;
    } else if (existingSet.has(username.toLowerCase())) {
      error = "Already in tournament";
    } else if (seenInBatch.has(username.toLowerCase())) {
      error = "Duplicate in CSV";
    }

    if (!error) seenInBatch.add(username.toLowerCase());

    rows.push({ rowNum, name, username, elo: isNaN(elo) ? 0 : elo, error });
  });

  return rows;
}

// ─── Sample CSV template ──────────────────────────────────────────────────────

const SAMPLE_CSV = `name,username,elo
Magnus Carlsen,MagnusCarlsen,2882
Hikaru Nakamura,hikaru,2794
Fabiano Caruana,FabianoCaruana,2804
Ian Nepomniachtchi,lachessis,2758
`;

function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "players_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Platform selector ────────────────────────────────────────────────────────

function PlatformPill({
  value,
  active,
  onClick,
  isDark,
}: {
  value: Platform;
  active: boolean;
  onClick: () => void;
  isDark: boolean;
}) {
  const labels: Record<Platform, string> = {
    "chess.com": "chess.com",
    lichess: "Lichess",
    manual: "Manual",
    csv: "Import CSV",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
      style={{
        background: active ? G : isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6",
        color: active ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.55)" : "#6B7280",
        boxShadow: active ? `0 2px 8px ${G_RING}` : "none",
        fontSize: value === "csv" ? 12 : undefined,
      }}
    >
      {labels[value]}
    </button>
  );
}

// ─── CSV Import Panel ─────────────────────────────────────────────────────────

interface CsvPanelProps {
  isDark: boolean;
  existingUsernames: string[];
  onBulkAdd: (players: Player[]) => void;
}

function CsvPanel({ isDark, existingUsernames, onBulkAdd }: CsvPanelProps) {
  const [rawText, setRawText] = useState("");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processText = useCallback(
    (text: string) => {
      setRawText(text);
      if (!text.trim()) { setRows([]); setParseError(""); return; }
      try {
        const parsed = parseCsv(text, existingUsernames);
        setRows(parsed);
        setParseError("");
      } catch {
        setParseError("Could not parse CSV. Check the format and try again.");
        setRows([]);
      }
    },
    [existingUsernames]
  );

  // Re-parse when existingUsernames changes (e.g. after adding some players)
  useEffect(() => {
    if (rawText) processText(rawText);
  }, [existingUsernames]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFile = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => processText((e.target?.result as string) ?? "");
    reader.readAsText(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const validRows = rows.filter((r) => r.error === null);
  const invalidRows = rows.filter((r) => r.error !== null);

  const handleBulkAdd = () => {
    if (validRows.length === 0) return;
    const players: Player[] = validRows.map((r) => ({
      id: nanoid(),
      name: r.name,
      username: r.username.toLowerCase().replace(/\s+/g, "_"),
      elo: r.elo,
      country: "Unknown",
      wins: 0, draws: 0, losses: 0,
      points: 0, buchholz: 0,
      colorHistory: [],
    }));
    onBulkAdd(players);
    // Remove added rows from the list
    setRows((prev) => prev.filter((r) => r.error !== null));
  };

  const textAreaBorder = isDragging
    ? `1.5px solid ${G}`
    : isDark ? "1.5px solid rgba(255,255,255,0.12)" : "1.5px solid #D1D5DB";

  return (
    <div className="space-y-4">
      {/* Drop zone / file picker */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: isDark ? "rgba(255,255,255,0.40)" : "#9CA3AF" }}
          >
            CSV File or Paste
          </label>
          <button
            type="button"
            onClick={downloadSampleCsv}
            className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: G }}
          >
            <Download className="w-3 h-3" />
            Sample template
          </button>
        </div>

        {/* Drag-and-drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 py-4 mb-3"
          style={{
            borderColor: isDragging ? G : isDark ? "rgba(255,255,255,0.15)" : "#D1D5DB",
            background: isDragging
              ? G_BG
              : isDark ? "rgba(255,255,255,0.02)" : "#FAFAFA",
          }}
        >
          <Upload
            className="w-5 h-5"
            style={{ color: isDragging ? G : isDark ? "rgba(255,255,255,0.30)" : "#9CA3AF" }}
          />
          <p className="text-xs" style={{ color: isDark ? "rgba(255,255,255,0.40)" : "#9CA3AF" }}>
            Drop a <strong>.csv</strong> file here, or{" "}
            <span style={{ color: G, fontWeight: 600 }}>click to browse</span>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>

        {/* Paste area */}
        <textarea
          value={rawText}
          onChange={(e) => processText(e.target.value)}
          placeholder={"name,username,elo\nMagnus Carlsen,MagnusCarlsen,2882\nHikaru Nakamura,hikaru,2794"}
          rows={5}
          className="w-full rounded-xl border outline-none transition-all duration-200 font-mono resize-none"
          style={{
            padding: "10px 14px",
            fontSize: 12,
            background: isDark ? "oklch(0.25 0.07 145)" : "#FAFAFA",
            border: textAreaBorder,
            color: isDark ? "#FFFFFF" : "#1A1A1A",
            lineHeight: 1.6,
          }}
          onFocus={(e) => { e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px ${G_RING}`; }}
          onBlur={(e) => { e.target.style.borderColor = isDark ? "rgba(255,255,255,0.12)" : "#D1D5DB"; e.target.style.boxShadow = "none"; }}
        />

        {parseError && (
          <div
            className="mt-2 flex items-center gap-2 rounded-xl border p-2.5 text-xs"
            style={{
              background: isDark ? "rgba(239,68,68,0.10)" : "#FEF2F2",
              border: `1.5px solid ${isDark ? "rgba(239,68,68,0.25)" : "#FECACA"}`,
              color: isDark ? "#FCA5A5" : "#DC2626",
            }}
          >
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {parseError}
          </div>
        )}
      </div>

      {/* Preview table */}
      {rows.length > 0 && (
        <div>
          {/* Summary bar */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span style={{ color: G }}>
                <CheckCircle2 className="inline w-3.5 h-3.5 mr-1" />
                {validRows.length} valid
              </span>
              {invalidRows.length > 0 && (
                <span style={{ color: isDark ? "#FCA5A5" : "#DC2626" }}>
                  <AlertCircle className="inline w-3.5 h-3.5 mr-1" />
                  {invalidRows.length} skipped
                </span>
              )}
            </div>
            {rawText && (
              <button
                type="button"
                onClick={() => { setRawText(""); setRows([]); }}
                className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
                style={{ color: isDark ? "rgba(255,255,255,0.35)" : "#9CA3AF" }}
              >
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          {/* Scrollable table */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "#E5E7EB"}` }}
          >
            <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ background: isDark ? "rgba(255,255,255,0.04)" : "#F9FAFB" }}>
                    {["#", "Name", "Username", "ELO", "Status"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-3 py-2 font-semibold"
                        style={{ color: isDark ? "rgba(255,255,255,0.40)" : "#6B7280", borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB"}` }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isValid = row.error === null;
                    const rowBg = !isValid
                      ? isDark ? "rgba(239,68,68,0.06)" : "#FFF5F5"
                      : "transparent";
                    return (
                      <tr
                        key={row.rowNum}
                        style={{ background: rowBg, borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6"}` }}
                      >
                        <td className="px-3 py-2" style={{ color: isDark ? "rgba(255,255,255,0.30)" : "#9CA3AF" }}>
                          {row.rowNum}
                        </td>
                        <td className="px-3 py-2 font-medium truncate max-w-[100px]" style={{ color: isDark ? "#FFFFFF" : "#1A1A1A" }}>
                          {row.name || <span style={{ color: isDark ? "rgba(255,255,255,0.25)" : "#D1D5DB" }}>—</span>}
                        </td>
                        <td className="px-3 py-2 font-mono truncate max-w-[90px]" style={{ color: isDark ? "rgba(255,255,255,0.65)" : "#374151" }}>
                          {row.username || <span style={{ color: isDark ? "rgba(255,255,255,0.25)" : "#D1D5DB" }}>—</span>}
                        </td>
                        <td className="px-3 py-2" style={{ color: isDark ? "rgba(255,255,255,0.65)" : "#374151" }}>
                          {row.elo > 0 ? row.elo : <span style={{ color: isDark ? "rgba(255,255,255,0.25)" : "#D1D5DB" }}>—</span>}
                        </td>
                        <td className="px-3 py-2">
                          {isValid ? (
                            <span className="flex items-center gap-1 font-semibold" style={{ color: G }}>
                              <CheckCircle2 className="w-3 h-3" /> OK
                            </span>
                          ) : (
                            <span className="flex items-center gap-1" style={{ color: isDark ? "#FCA5A5" : "#DC2626" }}>
                              <AlertCircle className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate max-w-[80px]">{row.error}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Column format hint */}
          <p className="mt-2 text-xs" style={{ color: isDark ? "rgba(255,255,255,0.25)" : "#9CA3AF" }}>
            Expected columns: <span className="font-mono">name, username, elo</span> · comma or tab separated · header optional
          </p>
        </div>
      )}

      {/* Bulk add button */}
      {validRows.length > 0 && (
        <button
          type="button"
          onClick={handleBulkAdd}
          className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200"
          style={{
            padding: "11px 22px",
            background: G,
            color: "#FFFFFF",
            boxShadow: `0 4px 14px ${G_RING}`,
          }}
        >
          <UserPlus className="w-4 h-4" />
          Add {validRows.length} player{validRows.length !== 1 ? "s" : ""} to Tournament
          <ChevronRight className="w-4 h-4 ml-auto opacity-60" />
        </button>
      )}

      {/* Empty state */}
      {rows.length === 0 && !rawText && (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <FileText className="w-8 h-8" style={{ color: isDark ? "rgba(255,255,255,0.15)" : "#D1D5DB" }} />
          <p className="text-xs" style={{ color: isDark ? "rgba(255,255,255,0.30)" : "#9CA3AF" }}>
            Drop a CSV file or paste player data above.<br />
            <button type="button" onClick={downloadSampleCsv} className="underline" style={{ color: G }}>
              Download the sample template
            </button>{" "}
            to get started.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface AddPlayerModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (player: Player) => void;
  existingUsernames: string[];
  /** Which chess.com rating category to use: "rapid" (default) or "blitz". */
  ratingType?: "rapid" | "blitz";
}

export function AddPlayerModal({ open, onClose, onAdd, existingUsernames, ratingType = "rapid" }: AddPlayerModalProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [platform, setPlatform] = useState<Platform>("chess.com");
  const [username, setUsername] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualElo, setManualElo] = useState("");
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "found" | "error">("idle");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const eloRef = useRef<HTMLInputElement>(null);

  // ── Reset helpers ─────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setUsername("");
    setManualName("");
    setManualElo("");
    setLookupState("idle");
    setLookupResult(null);
    setLookupError("");
  }, []);

  useEffect(() => {
    if (open) {
      resetForm();
      setJustAdded(null);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open, platform]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) setAddedCount(0);
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // ── Lookup ────────────────────────────────────────────────────────────────

  const handleLookup = useCallback(async () => {
    const u = username.trim();
    if (!u) return;
    if (existingUsernames.map((x) => x.toLowerCase()).includes(u.toLowerCase())) {
      setLookupState("error");
      setLookupError("This player is already registered.");
      return;
    }
    setLookupState("loading");
    setLookupResult(null);
    setLookupError("");
    try {
      const result = platform === "chess.com" ? await lookupChessCom(u) : await lookupLichess(u);
      setLookupResult(result);
      setLookupState("found");
    } catch (err) {
      setLookupState("error");
      setLookupError(err instanceof Error ? err.message : "Lookup failed. Check the username.");
    }
  }, [username, platform, existingUsernames]);

  // ── Add single player ─────────────────────────────────────────────────────

  const handleAdd = useCallback(() => {
    let player: Player;

    if (platform === "manual") {
      const name = manualName.trim();
      const elo = parseInt(manualElo, 10);
      if (!name) { toast.error("Please enter a player name."); return; }
      if (isNaN(elo) || elo < 100 || elo > 3500) { toast.error("Please enter a valid ELO (100–3500)."); return; }
      player = {
        id: nanoid(), name,
        username: name.toLowerCase().replace(/\s+/g, "_"),
        elo, country: "Unknown",
        wins: 0, draws: 0, losses: 0, points: 0, buchholz: 0, colorHistory: [],
      };
    } else {
      if (lookupState !== "found" || !lookupResult) return;
      player = {
        id: nanoid(),
        name: lookupResult.name || lookupResult.username,
        username: lookupResult.username,
        elo: platform === "chess.com" && ratingType === "blitz"
          ? (lookupResult.blitz || lookupResult.rapid || lookupResult.bullet || lookupResult.elo)
          : (lookupResult.rapid || lookupResult.blitz || lookupResult.bullet || lookupResult.elo),
        platform: platform === "chess.com" ? "chesscom" : "lichess",
        country: lookupResult.country ?? "Unknown",
        title: lookupResult.title as Player["title"],
        avatarUrl: lookupResult.avatar,
        wins: 0, draws: 0, losses: 0, points: 0, buchholz: 0, colorHistory: [],
      };
    }

    onAdd(player);
    setAddedCount((c) => c + 1);
    setJustAdded(player.name);
    setTimeout(() => {
      setJustAdded(null);
      resetForm();
      setTimeout(() => inputRef.current?.focus(), 40);
    }, 900);
  }, [platform, manualName, manualElo, lookupState, lookupResult, ratingType, onAdd, resetForm]);

  // ── Bulk add (CSV) ────────────────────────────────────────────────────────

  const handleBulkAdd = useCallback((players: Player[]) => {
    players.forEach((p) => onAdd(p));
    setAddedCount((c) => c + players.length);
    toast.success(`${players.length} player${players.length !== 1 ? "s" : ""} added to the tournament.`);
  }, [onAdd]);

  // ── Enter key logic ───────────────────────────────────────────────────────

  const handleUsernameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (lookupState === "found") handleAdd();
    else handleLookup();
  };

  const handleManualNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!manualElo.trim()) eloRef.current?.focus();
    else if (canAdd) handleAdd();
  };

  const handleManualEloKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (canAdd) handleAdd();
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const canAdd =
    platform === "manual"
      ? manualName.trim().length > 0 && parseInt(manualElo, 10) >= 100
      : lookupState === "found";

  if (!open) return null;

  const isCsvMode = platform === "csv";

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full rounded-2xl shadow-2xl overflow-hidden"
        style={{
          maxWidth: isCsvMode ? 560 : 448,
          background: isDark ? "oklch(0.22 0.06 145)" : "#FFFFFF",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "#E5E7EB"}`,
          animation: "modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both",
          transition: "max-width 0.25s ease",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "#F0F0F0" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: G }}>
              <User className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <span
                className="text-sm font-bold"
                style={{ fontFamily: "'Clash Display', sans-serif", color: isDark ? "#FFFFFF" : "#1A1A1A" }}
              >
                Add Player{isCsvMode ? "s" : ""}
              </span>
              {addedCount > 0 && (
                <span
                  className="ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: G_BG, color: G }}
                >
                  {addedCount} added
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6", color: isDark ? "rgba(255,255,255,0.55)" : "#6B7280" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Platform / mode selector */}
          <div>
            <label
              className="text-xs font-semibold uppercase tracking-widest mb-2 block"
              style={{ color: isDark ? "rgba(255,255,255,0.40)" : "#9CA3AF" }}
            >
              Mode
            </label>
            <div
              className="flex gap-1.5 p-1 rounded-xl"
              style={{ background: isDark ? "rgba(255,255,255,0.04)" : "#F3F4F6" }}
            >
              {(["chess.com", "lichess", "manual", "csv"] as Platform[]).map((p) => (
                <PlatformPill key={p} value={p} active={platform === p} onClick={() => setPlatform(p)} isDark={isDark} />
              ))}
            </div>
          </div>

          {/* CSV mode */}
          {isCsvMode && (
            <CsvPanel isDark={isDark} existingUsernames={existingUsernames} onBulkAdd={handleBulkAdd} />
          )}

          {/* Single-add modes */}
          {!isCsvMode && (
            <>
              {/* "Just added" flash banner */}
              {justAdded && (
                <div
                  className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold"
                  style={{
                    background: isDark ? G_BG : "#F0FDF4",
                    border: `1.5px solid ${isDark ? "rgba(61,107,71,0.35)" : "#BBF7D0"}`,
                    color: G,
                    animation: "fadeInUp 0.18s ease both",
                  }}
                >
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{justAdded} added!</span>
                  <span className="ml-auto text-xs opacity-60 flex-shrink-0">Type next player ↵</span>
                </div>
              )}

              {/* Username lookup (chess.com / lichess) */}
              {platform !== "manual" && (
                <div>
                  <label
                    className="text-xs font-semibold uppercase tracking-widest mb-2 block"
                    style={{ color: isDark ? "rgba(255,255,255,0.40)" : "#9CA3AF" }}
                  >
                    {platform === "chess.com" ? "chess.com Username" : "Lichess Username"}
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: isDark ? "rgba(255,255,255,0.30)" : "#9CA3AF" }} />
                      <input
                        ref={inputRef}
                        type="text"
                        value={username}
                        onChange={(e) => { setUsername(e.target.value); setLookupState("idle"); setLookupResult(null); }}
                        onKeyDown={handleUsernameKeyDown}
                        placeholder={platform === "chess.com" ? "e.g. hikaru" : "e.g. DrNykterstein"}
                        className="w-full rounded-xl border outline-none transition-all duration-200"
                        style={{
                          padding: "10px 14px 10px 38px", fontSize: 14,
                          background: isDark ? "oklch(0.25 0.07 145)" : "#FAFAFA",
                          border: `1.5px solid ${isDark ? "rgba(255,255,255,0.12)" : "#D1D5DB"}`,
                          color: isDark ? "#FFFFFF" : "#1A1A1A",
                        }}
                        onFocus={(e) => { e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px ${G_RING}`; }}
                        onBlur={(e) => { e.target.style.borderColor = isDark ? "rgba(255,255,255,0.12)" : "#D1D5DB"; e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={lookupState === "found" ? handleAdd : handleLookup}
                      disabled={!username.trim() || lookupState === "loading"}
                      className="flex items-center gap-1.5 rounded-xl text-sm font-semibold transition-all duration-200 flex-shrink-0"
                      style={{
                        padding: "10px 18px",
                        background: username.trim() ? G : isDark ? "rgba(255,255,255,0.08)" : "#F0F5EE",
                        color: username.trim() ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.25)" : "#9CA3AF",
                        cursor: username.trim() ? "pointer" : "not-allowed",
                      }}
                    >
                      {lookupState === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : lookupState === "found" ? <><UserPlus className="w-4 h-4" /> Add</> : "Look up"}
                    </button>
                  </div>

                  {lookupState === "found" && lookupResult && (
                    <div
                      className="mt-3 flex items-center gap-3 rounded-xl border p-3"
                      style={{ background: isDark ? G_BG : "#F0FDF4", border: `1.5px solid ${isDark ? "rgba(61,107,71,0.35)" : "#BBF7D0"}`, animation: "fadeInUp 0.2s ease both" }}
                    >
                      {lookupResult.avatar ? (
                        <img src={lookupResult.avatar} alt={lookupResult.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white" style={{ background: G }}>
                          {(lookupResult.name || lookupResult.username)[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: isDark ? "#FFFFFF" : "#1A1A1A" }}>
                          {lookupResult.title && <span className="text-amber-500 mr-1">{lookupResult.title}</span>}
                          {lookupResult.name || lookupResult.username}
                        </p>
                        <p className="text-xs" style={{ color: isDark ? "rgba(255,255,255,0.50)" : "#6B7280" }}>
                          @{lookupResult.username} · ELO {lookupResult.elo}
                          {lookupResult.country && ` · ${lookupResult.country}`}
                        </p>
                      </div>
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: G }} />
                    </div>
                  )}

                  {lookupState === "error" && (
                    <div
                      className="mt-3 flex items-center gap-2 rounded-xl border p-3 text-sm"
                      style={{ background: isDark ? "rgba(239,68,68,0.10)" : "#FEF2F2", border: `1.5px solid ${isDark ? "rgba(239,68,68,0.25)" : "#FECACA"}`, color: isDark ? "#FCA5A5" : "#DC2626", animation: "fadeInUp 0.2s ease both" }}
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {lookupError}
                    </div>
                  )}

                  {lookupState === "found" && !justAdded && (
                    <p className="mt-2 text-xs text-center" style={{ color: isDark ? "rgba(255,255,255,0.30)" : "#9CA3AF" }}>
                      Press <kbd className="px-1 py-0.5 rounded text-[10px] font-mono" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#F3F4F6" }}>Enter</kbd> to add · then type the next player
                    </p>
                  )}
                </div>
              )}

              {/* Manual entry */}
              {platform === "manual" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color: isDark ? "rgba(255,255,255,0.40)" : "#9CA3AF" }}>
                      Full Name
                    </label>
                    <input
                      ref={inputRef}
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      onKeyDown={handleManualNameKeyDown}
                      placeholder="e.g. Magnus Carlsen"
                      className="w-full rounded-xl border outline-none transition-all duration-200"
                      style={{ padding: "10px 14px", fontSize: 14, background: isDark ? "oklch(0.25 0.07 145)" : "#FAFAFA", border: `1.5px solid ${isDark ? "rgba(255,255,255,0.12)" : "#D1D5DB"}`, color: isDark ? "#FFFFFF" : "#1A1A1A" }}
                      onFocus={(e) => { e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px ${G_RING}`; }}
                      onBlur={(e) => { e.target.style.borderColor = isDark ? "rgba(255,255,255,0.12)" : "#D1D5DB"; e.target.style.boxShadow = "none"; }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color: isDark ? "rgba(255,255,255,0.40)" : "#9CA3AF" }}>
                      ELO Rating
                    </label>
                    <input
                      ref={eloRef}
                      type="number"
                      value={manualElo}
                      onChange={(e) => setManualElo(e.target.value)}
                      onKeyDown={handleManualEloKeyDown}
                      placeholder="e.g. 1500"
                      min={100} max={3500}
                      className="w-full rounded-xl border outline-none transition-all duration-200"
                      style={{ padding: "10px 14px", fontSize: 14, background: isDark ? "oklch(0.25 0.07 145)" : "#FAFAFA", border: `1.5px solid ${isDark ? "rgba(255,255,255,0.12)" : "#D1D5DB"}`, color: isDark ? "#FFFFFF" : "#1A1A1A" }}
                      onFocus={(e) => { e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px ${G_RING}`; }}
                      onBlur={(e) => { e.target.style.borderColor = isDark ? "rgba(255,255,255,0.12)" : "#D1D5DB"; e.target.style.boxShadow = "none"; }}
                    />
                  </div>
                  {canAdd && !justAdded && (
                    <p className="text-xs text-center" style={{ color: isDark ? "rgba(255,255,255,0.30)" : "#9CA3AF" }}>
                      Press <kbd className="px-1 py-0.5 rounded text-[10px] font-mono" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#F3F4F6" }}>Enter</kbd> to add · then type the next player
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — hidden in CSV mode (action is inline) */}
        {!isCsvMode && (
          <div
            className="flex items-center justify-between px-6 py-4 border-t"
            style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "#F0F0F0" }}
          >
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              style={{ color: isDark ? "rgba(255,255,255,0.55)" : "#6B7280" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              {addedCount > 0 ? `Done (${addedCount} added)` : "Cancel"}
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!canAdd}
              className="flex items-center gap-2 text-sm font-semibold rounded-xl transition-all duration-200"
              style={{
                padding: "10px 22px",
                background: canAdd ? G : isDark ? "rgba(255,255,255,0.08)" : "#F0F5EE",
                color: canAdd ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.25)" : "#9CA3AF",
                cursor: canAdd ? "pointer" : "not-allowed",
                boxShadow: canAdd ? `0 4px 14px ${G_RING}` : "none",
              }}
            >
              <UserPlus className="w-4 h-4" />
              Add to Tournament
            </button>
          </div>
        )}

        {/* CSV mode footer — just a close button */}
        {isCsvMode && (
          <div
            className="flex items-center justify-end px-6 py-4 border-t"
            style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "#F0F0F0" }}
          >
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              style={{ color: isDark ? "rgba(255,255,255,0.55)" : "#6B7280" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              {addedCount > 0 ? `Done (${addedCount} added)` : "Close"}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}
