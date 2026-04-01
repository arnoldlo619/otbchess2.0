/*
 * UploadRSVPModal — Director uploads a CSV or XLSX file containing chess.com
 * (or Lichess) usernames to bulk-register players into the tournament.
 *
 * Flow:
 *   1. Director drops or selects a .csv / .xlsx / .xls file
 *   2. We parse the file and extract usernames from any column whose header
 *      contains "username", "user", "chess", "lichess", or "name"
 *      (case-insensitive). If no header matches we fall back to the first column.
 *   3. We show a preview table. Each row has:
 *      • A checkbox (checked by default for Ready rows, disabled for Duplicate/Error)
 *      • Status badge: Pending / Loading / Ready / Duplicate / Error
 *      • Name and ELO once looked up
 *   4. A "Select All / Deselect All" toggle controls all Ready rows at once.
 *   5. Director clicks "Import Selected" to bulk-call onAdd for all checked Ready rows.
 */

import { useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { nanoid } from "nanoid";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  Info,
  Search,
} from "lucide-react";
import type { Player } from "@/lib/tournamentData";

// ─── Types ────────────────────────────────────────────────────────────────────
type RowStatus = "pending" | "loading" | "ready" | "duplicate" | "error";
type Platform = "chesscom" | "lichess";

interface RSVPRow {
  rawUsername: string;
  status: RowStatus;
  player?: Player;
  errorMsg?: string;
  /** Whether the director has this row checked for import (only relevant when status === "ready") */
  selected: boolean;
}

interface UploadRSVPModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (player: Player) => void;
  existingUsernames: string[];
}

// ─── API helpers (same logic as AddPlayerModal) ───────────────────────────────
async function lookupChessCom(username: string): Promise<Partial<Player>> {
  const [profileRes, statsRes] = await Promise.all([
    fetch(`https://api.chess.com/pub/player/${username.toLowerCase()}`),
    fetch(`https://api.chess.com/pub/player/${username.toLowerCase()}/stats`),
  ]);
  if (!profileRes.ok) throw new Error("Not found on chess.com");
  const profile = await profileRes.json();
  const stats = statsRes.ok ? await statsRes.json() : {};
  const elo =
    stats?.chess_rapid?.last?.rating ??
    stats?.chess_blitz?.last?.rating ??
    stats?.chess_bullet?.last?.rating ??
    1200;
  return {
    name: profile.name || profile.username,
    username: profile.username,
    elo,
    avatarUrl: profile.avatar,
    country: profile.country?.split("/").pop()?.toUpperCase() ?? "US",
    title: profile.title,
    platform: "chesscom",
  };
}

async function lookupLichess(username: string): Promise<Partial<Player>> {
  const res = await fetch(`https://lichess.org/api/user/${username.toLowerCase()}`);
  if (!res.ok) throw new Error("Not found on Lichess");
  const data = await res.json();
  const perfs = data.perfs ?? {};
  const elo =
    perfs.rapid?.rating ??
    perfs.blitz?.rating ??
    perfs.bullet?.rating ??
    perfs.classical?.rating ??
    1500;
  return {
    name: data.profile?.realName || data.username,
    username: data.username,
    elo,
    country: data.profile?.country ?? "US",
    title: data.title,
    platform: "lichess",
  };
}

function makePlayer(partial: Partial<Player>): Player {
  return {
    id: nanoid(),
    name: partial.name ?? partial.username ?? "Unknown",
    username: partial.username ?? "",
    elo: partial.elo ?? 1200,
    title: partial.title,
    country: partial.country ?? "US",
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    buchholz: 0,
    colorHistory: [],
    avatarUrl: partial.avatarUrl,
    platform: partial.platform,
  };
}

// ─── Parse helpers ────────────────────────────────────────────────────────────
function extractUsernames(rows: Record<string, string>[]): string[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const preferred = headers.find((h) =>
    /username|user|chess|lichess|handle|player/i.test(h)
  ) ?? headers[0];
  return rows
    .map((r) => (r[preferred] ?? "").trim())
    .filter(Boolean);
}

function parseCSV(text: string): string[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return extractUsernames(result.data);
}

function parseXLSX(buffer: ArrayBuffer): string[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
    defval: "",
    raw: false,
  });
  return extractUsernames(rows);
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, errorMsg, isDark }: { status: RowStatus; errorMsg?: string; isDark: boolean }) {
  if (status === "loading") return (
    <span className="flex items-center gap-1 text-xs text-amber-400">
      <Loader2 className="w-3 h-3 animate-spin" /> Looking up…
    </span>
  );
  if (status === "ready") return (
    <span className="flex items-center gap-1 text-xs text-emerald-400">
      <CheckCircle2 className="w-3 h-3" /> Ready
    </span>
  );
  if (status === "duplicate") return (
    <span className={`flex items-center gap-1 text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
      <Info className="w-3 h-3" /> Already added
    </span>
  );
  if (status === "error") return (
    <span className="flex items-center gap-1 text-xs text-red-400" title={errorMsg}>
      <AlertCircle className="w-3 h-3" /> Not found
    </span>
  );
  return (
    <span className={`flex items-center gap-1 text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>
      Pending
    </span>
  );
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────
function Checkbox({
  checked,
  indeterminate,
  onChange,
  disabled,
  isDark,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  disabled?: boolean;
  isDark: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      disabled={disabled}
      onClick={onChange}
      className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-all ${
        disabled
          ? isDark ? "border-white/10 opacity-30 cursor-not-allowed" : "border-gray-200 opacity-30 cursor-not-allowed"
          : checked || indeterminate
          ? "bg-[#3D6B47] border-[#3D6B47]"
          : isDark
          ? "border-white/20 hover:border-white/40"
          : "border-gray-300 hover:border-gray-400"
      }`}
    >
      {indeterminate ? (
        <span className="block w-2 h-0.5 bg-white rounded-full" />
      ) : checked ? (
        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function UploadRSVPModal({
  open,
  onClose,
  onAdd,
  existingUsernames,
}: UploadRSVPModalProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [rows, setRows] = useState<RSVPRow[]>([]);
  const [platform, setPlatform] = useState<Platform>("chesscom");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [lookupStarted, setLookupStarted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lookupInProgress = useRef(false);

  // ── Reset state on close ────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setRows([]);
    setFileName(null);
    setLookupStarted(false);
    lookupInProgress.current = false;
    onClose();
  }, [onClose]);

  // ── Parse file ──────────────────────────────────────────────────────────────
  const processFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      setRows([]);
      setLookupStarted(false);

      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["csv", "xlsx", "xls"].includes(ext ?? "")) {
        toast.error("Please upload a .csv, .xlsx, or .xls file");
        return;
      }

      if (ext === "csv") {
        const reader = new FileReader();
        reader.onload = (e) => {
          const usernames = parseCSV(e.target?.result as string);
          initRows(usernames);
        };
        reader.readAsText(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const usernames = parseXLSX(e.target?.result as ArrayBuffer);
          initRows(usernames);
        };
        reader.readAsArrayBuffer(file);
      }
    },
    [existingUsernames] // eslint-disable-line react-hooks/exhaustive-deps
  );

  function initRows(usernames: string[]) {
    if (usernames.length === 0) {
      toast.error("No usernames found. Make sure the file has a column with usernames.");
      return;
    }
    const seen = new Set<string>();
    const newRows: RSVPRow[] = [];
    for (const u of usernames) {
      const lower = u.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      const isDuplicate = existingUsernames.some((e) => e.toLowerCase() === lower);
      newRows.push({
        rawUsername: u,
        status: isDuplicate ? "duplicate" : "pending",
        selected: false, // not selectable until status === "ready"
      });
    }
    setRows(newRows);
  }

  // ── Drag-and-drop ───────────────────────────────────────────────────────────
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  // ── Lookup all pending rows ─────────────────────────────────────────────────
  const handleLookup = useCallback(async () => {
    if (lookupInProgress.current) return;
    lookupInProgress.current = true;
    setLookupStarted(true);

    const BATCH = 3;
    const indices = rows
      .map((r, i) => (r.status === "pending" ? i : -1))
      .filter((i) => i >= 0);

    for (let b = 0; b < indices.length; b += BATCH) {
      const batch = indices.slice(b, b + BATCH);
      setRows((prev) =>
        prev.map((r, i) =>
          batch.includes(i) ? { ...r, status: "loading" } : r
        )
      );
      await Promise.all(
        batch.map(async (idx) => {
          const username = rows[idx].rawUsername;
          try {
            const partial =
              platform === "chesscom"
                ? await lookupChessCom(username)
                : await lookupLichess(username);
            const player = makePlayer(partial);
            setRows((prev) =>
              prev.map((r, i) =>
                i === idx ? { ...r, status: "ready", player, selected: true } : r
              )
            );
          } catch (err) {
            setRows((prev) =>
              prev.map((r, i) =>
                i === idx
                  ? { ...r, status: "error", errorMsg: (err as Error).message, selected: false }
                  : r
              )
            );
          }
        })
      );
      if (b + BATCH < indices.length) await new Promise((r) => setTimeout(r, 400));
    }
    lookupInProgress.current = false;
  }, [rows, platform]);

  // ── Checkbox helpers ────────────────────────────────────────────────────────
  const toggleRow = useCallback((idx: number) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx && r.status === "ready" ? { ...r, selected: !r.selected } : r
      )
    );
  }, []);

  const readyRows = rows.filter((r) => r.status === "ready");
  const selectedReadyRows = readyRows.filter((r) => r.selected);
  const allSelected = readyRows.length > 0 && selectedReadyRows.length === readyRows.length;
  const someSelected = selectedReadyRows.length > 0 && !allSelected;

  const toggleSelectAll = useCallback(() => {
    const shouldSelectAll = !allSelected;
    setRows((prev) =>
      prev.map((r) =>
        r.status === "ready" ? { ...r, selected: shouldSelectAll } : r
      )
    );
  }, [allSelected]);

  // ── Import selected players ─────────────────────────────────────────────────
  const handleImportSelected = useCallback(() => {
    const toAdd = rows.filter((r) => r.status === "ready" && r.selected && r.player);
    if (toAdd.length === 0) return;
    toAdd.forEach((r) => onAdd(r.player!));
    toast.success(`Added ${toAdd.length} player${toAdd.length > 1 ? "s" : ""} to the tournament`);
    handleClose();
  }, [rows, onAdd, handleClose]);

  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const errorCount = rows.filter((r) => r.status === "error").length;
  const loadingCount = rows.filter((r) => r.status === "loading").length;
  const isLookingUp = loadingCount > 0;

  if (!open) return null;

  return createPortal(
    <div
      className="modal-overlay z-50"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className={`relative z-10 w-full max-w-2xl my-auto flex flex-col rounded-2xl shadow-2xl border overflow-hidden ${
          isDark
            ? "bg-[oklch(0.18_0.05_145)] border-white/10"
            : "bg-white border-gray-200"
        }`}
        style={{ marginTop: "max(1rem, 8vh)", marginBottom: "max(1rem, 8vh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? "border-white/08" : "border-gray-100"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isDark ? "bg-[#3D6B47]/30" : "bg-[#3D6B47]/10"
            }`}>
              <FileSpreadsheet className="w-4.5 h-4.5 text-[#4CAF50]" />
            </div>
            <div>
              <h2
                className={`text-base font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Upload RSVPs
              </h2>
              <p className={`text-xs ${isDark ? "text-white/40" : "text-gray-500"}`}>
                Bulk-register players from a spreadsheet
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? "text-white/40 hover:text-white/70 hover:bg-white/08" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Platform selector */}
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium ${isDark ? "text-white/50" : "text-gray-500"}`}>Platform:</span>
            {(["chesscom", "lichess"] as Platform[]).map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                  platform === p
                    ? isDark
                      ? "bg-[#3D6B47]/30 border-[#4CAF50]/40 text-[#4CAF50]"
                      : "bg-[#3D6B47]/10 border-[#3D6B47]/40 text-[#3D6B47]"
                    : isDark
                    ? "border-white/10 text-white/40 hover:text-white/60"
                    : "border-gray-200 text-gray-400 hover:text-gray-600"
                }`}
              >
                {p === "chesscom" ? "chess.com" : "Lichess"}
              </button>
            ))}
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 cursor-pointer transition-all ${
              isDragging
                ? isDark
                  ? "border-[#4CAF50]/60 bg-[#3D6B47]/20"
                  : "border-[#3D6B47]/50 bg-[#3D6B47]/05"
                : isDark
                ? "border-white/10 hover:border-white/20 hover:bg-white/03"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <Upload className={`w-8 h-8 ${isDark ? "text-white/30" : "text-gray-300"}`} />
            <div className="text-center">
              <p className={`text-sm font-medium ${isDark ? "text-white/70" : "text-gray-700"}`}>
                {fileName ? fileName : "Drop your spreadsheet here"}
              </p>
              <p className={`text-xs mt-1 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                Supports .csv, .xlsx, .xls · Column named "username" or first column
              </p>
            </div>
            <span className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${
              isDark ? "border-white/10 text-white/40" : "border-gray-200 text-gray-400"
            }`}>
              Browse files
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processFile(file);
                e.target.value = "";
              }}
            />
          </div>

          {/* Template download hint */}
          <div className={`flex items-start gap-2 text-xs rounded-xl px-4 py-3 ${
            isDark ? "bg-white/04 text-white/40" : "bg-gray-50 text-gray-500"
          }`}>
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Your spreadsheet should have a column header containing "username". Each row should have one {platform === "chesscom" ? "chess.com" : "Lichess"} username.
              {" "}<button
                className={`underline underline-offset-2 ${isDark ? "text-[#4CAF50]/70 hover:text-[#4CAF50]" : "text-[#3D6B47] hover:text-[#2A4A32]"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  const csv = "username\nhikaru\nmagnus\nalireza\n";
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "rsvp-template.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download template
              </button>
            </span>
          </div>

          {/* Preview table */}
          {rows.length > 0 && (
            <div className="space-y-3">
              {/* Summary row */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-xs font-semibold ${isDark ? "text-white/70" : "text-gray-700"}`}>
                    {rows.length} usernames found
                  </span>
                  {readyRows.length > 0 && (
                    <span className="text-xs text-emerald-400 font-medium">{readyRows.length} ready</span>
                  )}
                  {errorCount > 0 && (
                    <span className="text-xs text-red-400 font-medium">{errorCount} not found</span>
                  )}
                  {loadingCount > 0 && (
                    <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> {loadingCount} looking up…
                    </span>
                  )}
                </div>

                {/* Select All / Deselect All — only shown when there are ready rows */}
                {readyRows.length > 0 && !isLookingUp && (
                  <button
                    onClick={toggleSelectAll}
                    className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                      isDark
                        ? "text-white/50 hover:text-white/80"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={toggleSelectAll}
                      isDark={isDark}
                    />
                    {allSelected ? "Deselect all" : someSelected ? "Select all" : "Select all"}
                  </button>
                )}
              </div>

              {/* Table */}
              <div className={`rounded-xl border overflow-hidden ${
                isDark ? "border-white/08" : "border-gray-100"
              }`}>
                {/* Column headers */}
                <div className={`grid text-xs font-semibold px-4 py-2 border-b ${
                  isDark ? "bg-white/04 text-white/40 border-white/08" : "bg-gray-50 text-gray-500 border-gray-100"
                }`} style={{ gridTemplateColumns: "1.5rem 1fr 1fr auto" }}>
                  <span />
                  <span>Username</span>
                  <span>Name / ELO</span>
                  <span>Status</span>
                </div>

                <div className={`divide-y max-h-64 overflow-y-auto ${isDark ? "divide-white/04" : "divide-gray-50"}`}>
                  {rows.map((row, i) => (
                    <div
                      key={i}
                      onClick={() => row.status === "ready" && toggleRow(i)}
                      className={`grid items-center px-4 py-2.5 text-xs transition-colors ${
                        row.status === "ready"
                          ? `cursor-pointer ${
                              row.selected
                                ? isDark ? "bg-emerald-900/15" : "bg-emerald-50/70"
                                : isDark ? "hover:bg-white/03" : "hover:bg-gray-50"
                            }`
                          : row.status === "error"
                          ? isDark ? "bg-red-900/10" : "bg-red-50/40"
                          : row.status === "duplicate"
                          ? isDark ? "bg-white/02" : "bg-gray-50/60"
                          : ""
                      }`}
                      style={{ gridTemplateColumns: "1.5rem 1fr 1fr auto" }}
                    >
                      {/* Checkbox */}
                      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={row.status === "ready" && row.selected}
                          onChange={() => toggleRow(i)}
                          disabled={row.status !== "ready"}
                          isDark={isDark}
                        />
                      </div>

                      {/* Username */}
                      <span className={`font-mono truncate ${isDark ? "text-white/70" : "text-gray-700"}`}>
                        {row.rawUsername}
                      </span>

                      {/* Name / ELO */}
                      <span className={`truncate ${isDark ? "text-white/50" : "text-gray-500"}`}>
                        {row.player
                          ? `${row.player.name} · ${row.player.elo}`
                          : "—"}
                      </span>

                      {/* Status */}
                      <StatusBadge status={row.status} errorMsg={row.errorMsg} isDark={isDark} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Selection count hint */}
              {readyRows.length > 0 && !isLookingUp && (
                <p className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>
                  {selectedReadyRows.length} of {readyRows.length} ready player{readyRows.length !== 1 ? "s" : ""} selected for import
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {rows.length > 0 && (
          <div className={`flex items-center justify-between gap-3 px-6 py-4 border-t ${
            isDark ? "border-white/08 bg-white/02" : "border-gray-100 bg-gray-50"
          }`}>
            <button
              onClick={handleClose}
              className={`text-sm font-medium px-4 py-2 rounded-xl border transition-colors ${
                isDark
                  ? "border-white/10 text-white/50 hover:text-white/70"
                  : "border-gray-200 text-gray-500 hover:text-gray-700"
              }`}
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              {/* Lookup button — shown when there are pending rows */}
              {pendingCount > 0 && !isLookingUp && (
                <button
                  onClick={handleLookup}
                  className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border transition-all ${
                    isDark
                      ? "border-[#4CAF50]/40 text-[#4CAF50] hover:bg-[#3D6B47]/20"
                      : "border-[#3D6B47]/40 text-[#3D6B47] hover:bg-[#3D6B47]/08"
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  Look up {pendingCount} username{pendingCount > 1 ? "s" : ""}
                </button>
              )}
              {isLookingUp && (
                <span className={`flex items-center gap-2 text-sm ${isDark ? "text-white/40" : "text-gray-400"}`}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Looking up players…
                </span>
              )}

              {/* Import Selected button */}
              <button
                onClick={handleImportSelected}
                disabled={selectedReadyRows.length === 0}
                className={`flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-xl transition-all ${
                  selectedReadyRows.length > 0
                    ? "bg-[#3D6B47] text-white hover:bg-[#2A4A32] shadow-sm"
                    : isDark
                    ? "bg-white/08 text-white/20 cursor-not-allowed"
                    : "bg-gray-100 text-gray-300 cursor-not-allowed"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Import {selectedReadyRows.length > 0 ? `${selectedReadyRows.length} ` : ""}Selected
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
