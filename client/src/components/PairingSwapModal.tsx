/**
 * PairingSwapModal
 * ────────────────
 * Allows a tournament director to correct a pairing mistake by:
 *   1. Selecting a player who is on the wrong board
 *   2. Selecting the player they should actually be playing
 *   3. Previewing the resulting swap
 *   4. Confirming — which swaps the two players' positions across both boards
 *
 * The swap operates on the current round's games array.
 * It swaps the two players while preserving board numbers, color assignments,
 * and all other game metadata (results stay as-is on each board).
 *
 * onSwap(updatedGames) is called with the new games array — the parent
 * is responsible for persisting the change to state and the server.
 */

import { useState, useMemo } from "react";
import { X, ArrowLeftRight, Search, Crown, AlertCircle } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import type { Player, Game } from "@/lib/tournamentData";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PairingSwapModalProps {
  open: boolean;
  games: Game[];
  players: Player[];
  roundNumber: number;
  onSwap: (updatedGames: Game[]) => void;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns which game a player is in and their color */
function findPlayerSlot(
  games: Game[],
  playerId: string
): { game: Game; color: "white" | "black" } | null {
  for (const g of games) {
    if (g.whiteId === playerId) return { game: g, color: "white" };
    if (g.blackId === playerId) return { game: g, color: "black" };
  }
  return null;
}

/**
 * Swap two players across the games array.
 * Each player keeps their own board/color slot; the other player's ID is placed there.
 * e.g. if A is White on Board 1 and B is Black on Board 3,
 *      after swap: B is White on Board 1, A is Black on Board 3.
 */
export function applyPairingSwap(
  games: Game[],
  playerAId: string,
  playerBId: string
): Game[] {
  const slotA = findPlayerSlot(games, playerAId);
  const slotB = findPlayerSlot(games, playerBId);
  if (!slotA || !slotB) return games;

  return games.map((g) => {
    if (g.id === slotA.game.id && g.id === slotB.game.id) {
      // Both players on the same board — swap their colors
      return {
        ...g,
        whiteId: slotA.color === "white" ? playerBId : playerAId,
        blackId: slotA.color === "black" ? playerBId : playerAId,
      };
    }
    if (g.id === slotA.game.id) {
      // Replace playerA with playerB in slotA's position
      return slotA.color === "white"
        ? { ...g, whiteId: playerBId }
        : { ...g, blackId: playerBId };
    }
    if (g.id === slotB.game.id) {
      // Replace playerB with playerA in slotB's position
      return slotB.color === "white"
        ? { ...g, whiteId: playerAId }
        : { ...g, blackId: playerAId };
    }
    return g;
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlayerPill({
  player,
  game,
  color,
  isDark,
  selected,
  onSelect,
  disabled,
}: {
  player: Player | undefined;
  game: Game;
  color: "white" | "black";
  isDark: boolean;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  if (!player) return null;
  const isBye = player.id === "BYE";
  return (
    <button
      onClick={onSelect}
      disabled={disabled || isBye}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
        selected
          ? isDark
            ? "border-[#4D6940]/70 bg-[#4D6940]/15 ring-1 ring-[#4D6940]/30"
            : "border-[#4D6940]/50 bg-[#4D6940]/08 ring-1 ring-[#4D6940]/20"
          : isDark
          ? "border-white/08 bg-[oklch(0.25_0.07_145)] hover:border-white/20 disabled:opacity-40"
          : "border-[#E8D9B0] bg-white hover:border-[#4D6940]/30 disabled:opacity-40"
      }`}
    >
      {/* Color dot */}
      <div className={`w-3 h-3 rounded-full flex-shrink-0 border ${
        color === "white"
          ? "bg-white border-[#E8D9B0]"
          : "bg-[#1A1A1A]/80 border-[#4D6940]/40"
      }`} />
      {/* Name + board */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${
          selected
            ? isDark ? "text-[#6FCF7F]" : "text-[#4D6940]"
            : isDark ? "text-white/90" : "text-[#1A1A1A]"
        }`}>
          {player.name}
        </p>
        <p className={`text-[10px] ${isDark ? "text-white/35" : "text-[#6B6B50]"}`}>
          {game.board === 1 && "♛ "}Board {game.board} · {color === "white" ? "White" : "Black"}
        </p>
      </div>
      {/* ELO */}
      {player.elo > 0 && (
        <span className={`text-xs font-mono flex-shrink-0 ${isDark ? "text-white/35" : "text-[#6B6B50]"}`}>
          {player.elo}
        </span>
      )}
      {selected && (
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isDark ? "bg-[#4CAF50]" : "bg-[#4D6940]"}`} />
      )}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PairingSwapModal({
  open,
  games,
  players,
  roundNumber,
  onSwap,
  onClose,
}: PairingSwapModalProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [search, setSearch] = useState("");
  const [selectedA, setSelectedA] = useState<string | null>(null);
  const [selectedB, setSelectedB] = useState<string | null>(null);

  // Build a flat list of all player slots (excluding BYE)
  const playerMap = useMemo(() => {
    const m = new Map<string, Player>();
    players.forEach((p) => m.set(p.id, p));
    return m;
  }, [players]);

  interface Slot { playerId: string; game: Game; color: "white" | "black"; }
  const allSlots: Slot[] = useMemo(() => {
    const slots: Slot[] = [];
    for (const g of games) {
      if (g.whiteId && g.whiteId !== "BYE") slots.push({ playerId: g.whiteId, game: g, color: "white" });
      if (g.blackId && g.blackId !== "BYE") slots.push({ playerId: g.blackId, game: g, color: "black" });
    }
    return slots;
  }, [games]);

  const filteredSlots = useMemo(() => {
    if (!search.trim()) return allSlots;
    const q = search.toLowerCase();
    return allSlots.filter(({ playerId }) => {
      const p = playerMap.get(playerId);
      return (
        p?.name.toLowerCase().includes(q) ||
        p?.username?.toLowerCase().includes(q)
      );
    });
  }, [allSlots, search, playerMap]);

  // Preview: what will the two boards look like after the swap?
  const preview = useMemo(() => {
    if (!selectedA || !selectedB) return null;
    const swapped = applyPairingSwap(games, selectedA, selectedB);
    const slotA = findPlayerSlot(games, selectedA)!;
    const slotB = findPlayerSlot(games, selectedB)!;
    const boardAAfter = swapped.find((g) => g.id === slotA.game.id)!;
    const boardBAfter = swapped.find((g) => g.id === slotB.game.id)!;
    return { boardAAfter, boardBAfter, slotA, slotB };
  }, [selectedA, selectedB, games]);

  const sameBoard = selectedA && selectedB && (() => {
    const sA = findPlayerSlot(games, selectedA);
    const sB = findPlayerSlot(games, selectedB);
    return sA && sB && sA.game.id === sB.game.id;
  })();

  function handleSelect(playerId: string) {
    if (!selectedA) {
      setSelectedA(playerId);
    } else if (selectedA === playerId) {
      setSelectedA(null);
    } else if (!selectedB) {
      setSelectedB(playerId);
    } else if (selectedB === playerId) {
      setSelectedB(null);
    } else {
      // Replace B with new selection
      setSelectedB(playerId);
    }
  }

  function handleConfirm() {
    if (!selectedA || !selectedB) return;
    const updated = applyPairingSwap(games, selectedA, selectedB);
    onSwap(updated);
    onClose();
  }

  function handleClose() {
    setSelectedA(null);
    setSelectedB(null);
    setSearch("");
    onClose();
  }

  if (!open) return null;

  const surface = isDark
    ? "bg-[oklch(0.20_0.06_145)] border-white/10"
    : "bg-white border-[#E8D9B0]";

  const playerA = selectedA ? playerMap.get(selectedA) : null;
  const playerB = selectedB ? playerMap.get(selectedB) : null;
  const slotA = selectedA ? findPlayerSlot(games, selectedA) : null;
  const slotB = selectedB ? findPlayerSlot(games, selectedB) : null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col max-h-[90vh] ${surface}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b flex-shrink-0 ${isDark ? "border-white/08" : "border-[#E8D9B0]/70"}`}>
          <div>
            <h2 className={`text-base font-bold flex items-center gap-2 ${isDark ? "text-white" : "text-[#1A1A1A]"}`}>
              <ArrowLeftRight className="w-4 h-4" />
              Swap Board Assignment
            </h2>
            <p className={`text-xs mt-0.5 ${isDark ? "text-white/40" : "text-[#6B6B50]"}`}>
              Round {roundNumber} · Select two players to swap
            </p>
          </div>
          <button
            onClick={handleClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isDark ? "hover:bg-white/08 text-white/50" : "hover:bg-[#E8D9B0]/50 text-[#6B6B50]"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selection summary strip */}
        <div className={`flex items-center gap-2 px-5 py-3 border-b flex-shrink-0 ${isDark ? "border-white/06 bg-white/02" : "border-[#E8D9B0]/70 bg-[#FFF3D5]/70/60"}`}>
          {/* Slot A */}
          <div className={`flex-1 px-3 py-2 rounded-xl border text-sm ${
            selectedA
              ? isDark ? "border-[#4D6940]/50 bg-[#4D6940]/10" : "border-[#4D6940]/30 bg-[#4D6940]/05"
              : isDark ? "border-white/08 bg-white/03" : "border-dashed border-[#E8D9B0] bg-white"
          }`}>
            {selectedA && playerA ? (
              <div>
                <p className={`font-semibold text-xs truncate ${isDark ? "text-white/90" : "text-[#1A1A1A]"}`}>{playerA.name}</p>
                <p className={`text-[10px] ${isDark ? "text-white/35" : "text-[#6B6B50]"}`}>Board {slotA?.game.board} · {slotA?.color}</p>
              </div>
            ) : (
              <p className={`text-xs ${isDark ? "text-white/25" : "text-[#6B6B50]"}`}>Select player 1</p>
            )}
          </div>

          <ArrowLeftRight className={`w-4 h-4 flex-shrink-0 ${isDark ? "text-white/25" : "text-[#6B6B50]/70"}`} />

          {/* Slot B */}
          <div className={`flex-1 px-3 py-2 rounded-xl border text-sm ${
            selectedB
              ? isDark ? "border-[#4D6940]/50 bg-[#4D6940]/10" : "border-[#4D6940]/30 bg-[#4D6940]/05"
              : isDark ? "border-white/08 bg-white/03" : "border-dashed border-[#E8D9B0] bg-white"
          }`}>
            {selectedB && playerB ? (
              <div>
                <p className={`font-semibold text-xs truncate ${isDark ? "text-white/90" : "text-[#1A1A1A]"}`}>{playerB.name}</p>
                <p className={`text-[10px] ${isDark ? "text-white/35" : "text-[#6B6B50]"}`}>Board {slotB?.game.board} · {slotB?.color}</p>
              </div>
            ) : (
              <p className={`text-xs ${isDark ? "text-white/25" : "text-[#6B6B50]"}`}>Select player 2</p>
            )}
          </div>
        </div>

        {/* Search */}
        <div className={`px-5 py-3 border-b flex-shrink-0 ${isDark ? "border-white/06" : "border-[#E8D9B0]/70"}`}>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
            isDark ? "bg-[oklch(0.25_0.07_145)] border-white/10" : "bg-white border-[#E8D9B0]"
          }`}>
            <Search className={`w-4 h-4 flex-shrink-0 ${isDark ? "text-white/30" : "text-[#6B6B50]"}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players…"
              className={`flex-1 bg-transparent text-sm outline-none ${
                isDark ? "text-white placeholder:text-white/30" : "text-[#1A1A1A] placeholder:text-[#6B6B50]/60"
              }`}
            />
            {search && (
              <button onClick={() => setSearch("")} className={isDark ? "text-white/30 hover:text-white/60" : "text-[#6B6B50] hover:text-[#6B6B50]"}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Player list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          {filteredSlots.length === 0 ? (
            <div className="text-center py-8">
              <p className={`text-sm ${isDark ? "text-white/35" : "text-[#6B6B50]"}`}>No players found</p>
            </div>
          ) : (
            filteredSlots.map(({ playerId, game, color }) => (
              <PlayerPill
                key={`${game.id}-${color}`}
                player={playerMap.get(playerId)}
                game={game}
                color={color}
                isDark={isDark}
                selected={selectedA === playerId || selectedB === playerId}
                onSelect={() => handleSelect(playerId)}
                disabled={false}
              />
            ))
          )}
        </div>

        {/* Preview */}
        {preview && (
          <div className={`px-5 py-3 border-t flex-shrink-0 ${isDark ? "border-white/08 bg-white/02" : "border-[#E8D9B0]/70 bg-[#FFF3D5]/70/40"}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? "text-white/30" : "text-[#6B6B50]"}`}>
              Preview after swap
            </p>
            {sameBoard && (
              <div className="flex items-center gap-1.5 mb-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-400">These players are on the same board — their colors will be swapped.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[preview.boardAAfter, preview.boardBAfter].filter((b, i, arr) => arr.findIndex(x => x.id === b.id) === i).map((board) => {
                const w = playerMap.get(board.whiteId);
                const b = playerMap.get(board.blackId);
                return (
                  <div key={board.id} className={`px-3 py-2 rounded-xl border ${isDark ? "border-white/08 bg-white/03" : "border-[#E8D9B0] bg-white"}`}>
                    <div className="flex items-center gap-1 mb-1">
                      {board.board === 1 && <Crown className="w-3 h-3 text-amber-400" />}
                      <span className={`font-bold ${isDark ? "text-white/50" : "text-[#6B6B50]"}`}>Board {board.board}</span>
                    </div>
                    <p className={`truncate ${isDark ? "text-white/80" : "text-[#1A1A1A]"}`}>⬜ {w?.name ?? "BYE"}</p>
                    <p className={`truncate ${isDark ? "text-white/80" : "text-[#1A1A1A]"}`}>⬛ {b?.name ?? "BYE"}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className={`flex items-center justify-end gap-2.5 px-5 py-4 border-t flex-shrink-0 ${isDark ? "border-white/08" : "border-[#E8D9B0]/70"}`}>
          <button
            onClick={handleClose}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              isDark ? "text-white/50 hover:text-white/80 hover:bg-white/06" : "text-[#6B6B50] hover:text-[#1A1A1A] hover:bg-[#E8D9B0]/50"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedA || !selectedB}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 ${
              isDark
                ? "bg-[#4D6940] text-white hover:bg-[#4CAF50] disabled:cursor-not-allowed"
                : "bg-[#4D6940] text-white hover:bg-[#2D5437] disabled:cursor-not-allowed"
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            Confirm Swap
          </button>
        </div>
      </div>
    </div>
  );
}
