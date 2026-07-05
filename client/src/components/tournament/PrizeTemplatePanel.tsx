/**
 * PrizeTemplatePanel
 *
 * Director-facing panel for configuring prizes in a Quads tournament.
 * Appears in the Director Dashboard after a tournament is completed (or during setup).
 *
 * Flow:
 * 1. Host selects a prize template (or custom)
 * 2. System generates prize slots based on sections
 * 3. Host reviews, edits values/types, adds sponsors
 * 4. On "Assign Winners" — auto-assigns based on final standings
 * 5. Host can override assignments manually
 */

import { useState, useMemo } from "react";
import {
  Trophy, Gift, DollarSign, Award, Sparkles, Check, Edit2,
  ChevronDown, ChevronUp, Users, Crown, Star
} from "lucide-react";

// ─── Types (mirror server/quadsCompletion.ts) ────────────────────────────────

type PrizeTemplateType =
  | "winner_each_quad"
  | "top_section_weighted"
  | "every_section_equal"
  | "quad1_podium_plus_winners"
  | "custom";

type PrizeType = "cash" | "gift_card" | "merch" | "trophy" | "raffle" | "recognition";

interface PrizeSlot {
  id: string;
  sectionId: string;
  sectionName: string;
  placement: number;
  prizeTitle: string;
  prizeType: PrizeType;
  prizeValue: string;
  sponsorName?: string;
  sponsorLogoUrl?: string;
  assignedPlayerId?: string;
  assignedPlayerName?: string;
  status: "pending" | "assigned" | "claimed";
  templateType: PrizeTemplateType;
}

interface SectionStanding {
  playerId: string;
  name: string;
  rank: number;
  score: number;
}

interface Section {
  id: string;
  name: string;
  standings: SectionStanding[];
}

type PrivacyMode = "standard" | "scholastic" | "anonymous";

interface PrizeTemplatePanelProps {
  prizes: PrizeSlot[];
  sections: Section[];
  tournamentCompleted: boolean;
  onSelectTemplate: (template: PrizeTemplateType) => void;
  onUpdatePrize: (prizeId: string, updates: Partial<PrizeSlot>) => void;
  onAutoAssign: () => void;
  onAddPrize: (sectionId: string) => void;
  onRemovePrize: (prizeId: string) => void;
  privacyMode?: PrivacyMode;
  onPrivacyModeChange?: (mode: PrivacyMode) => void;
}

const TEMPLATE_OPTIONS: { type: PrizeTemplateType; label: string; description: string; icon: typeof Trophy }[] = [
  { type: "winner_each_quad", label: "Winner Each Quad", description: "One prize per section — simple and fair", icon: Trophy },
  { type: "top_section_weighted", label: "Top Section Weighted", description: "Higher prizes for top-rated sections", icon: Crown },
  { type: "every_section_equal", label: "Every Section Equal", description: "Same prize amount for all section winners", icon: Users },
  { type: "quad1_podium_plus_winners", label: "Quad 1 Podium + Winners", description: "Top 3 in Quad 1, winner in all others", icon: Star },
  { type: "custom", label: "Custom", description: "Build your own prize structure", icon: Edit2 },
];

const PRIZE_TYPE_OPTIONS: { value: PrizeType; label: string; icon: typeof DollarSign }[] = [
  { value: "cash", label: "Cash", icon: DollarSign },
  { value: "gift_card", label: "Gift Card", icon: Gift },
  { value: "merch", label: "Merch", icon: Award },
  { value: "trophy", label: "Trophy", icon: Trophy },
  { value: "raffle", label: "Raffle", icon: Sparkles },
  { value: "recognition", label: "Recognition", icon: Star },
];

export default function PrizeTemplatePanel({
  prizes,
  sections,
  tournamentCompleted,
  onSelectTemplate,
  onUpdatePrize,
  onAutoAssign,
  onAddPrize,
  onRemovePrize,
  privacyMode = "standard",
  onPrivacyModeChange,
}: PrizeTemplatePanelProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [editingPrize, setEditingPrize] = useState<string | null>(null);

  const activeTemplate = prizes.length > 0 ? prizes[0].templateType : null;
  const allAssigned = prizes.length > 0 && prizes.every((p) => p.status === "assigned");
  const hasPendingPrizes = prizes.some((p) => p.status === "pending");

  const prizesBySection = useMemo(() => {
    const map = new Map<string, PrizeSlot[]>();
    for (const p of prizes) {
      const arr = map.get(p.sectionId) || [];
      arr.push(p);
      map.set(p.sectionId, arr);
    }
    return map;
  }, [prizes]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={18} style={{ color: "oklch(0.75 0.15 85)" }} />
          <h3 className="text-sm font-bold" style={{ color: "oklch(0.92 0.02 145)" }}>
            Prize Configuration
          </h3>
        </div>
        {tournamentCompleted && hasPendingPrizes && (
          <button
            onClick={onAutoAssign}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
            style={{ background: "oklch(0.45 0.12 145)", color: "#fff" }}
          >
            <Sparkles size={12} />
            Auto-Assign Winners
          </button>
        )}
      </div>

      {/* Privacy Mode Selector */}
      {onPrivacyModeChange && (
        <div className="p-3 rounded-xl" style={{ background: "oklch(0.16 0.03 145)", border: "1px solid oklch(0.25 0.04 145)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "oklch(0.55 0.04 145)" }}>Recap Privacy</p>
          <div className="flex gap-2 flex-wrap">
            {(["standard", "scholastic", "anonymous"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onPrivacyModeChange(mode)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                  privacyMode === mode
                    ? "border"
                    : "border border-transparent hover:border-white/10"
                }`}
                style={privacyMode === mode ? { background: "oklch(0.25 0.08 145)", borderColor: "oklch(0.40 0.10 145)", color: "oklch(0.85 0.05 145)" } : { color: "oklch(0.60 0.04 145)" }}
              >
                {mode === "standard" ? "Full Names" : mode === "scholastic" ? "First Name + Last Initial" : "Anonymous"}
              </button>
            ))}
          </div>
          <p className="text-[9px] mt-1.5" style={{ color: "oklch(0.45 0.04 145)" }}>
            {privacyMode === "scholastic" ? "Ideal for youth/scholastic events — shows first name + last initial only" : privacyMode === "anonymous" ? "Hides all player names in the public recap" : "Full player names visible in the public recap"}
          </p>
        </div>
      )}

      {/* Template Selector (only if no prizes configured yet) */}
      {prizes.length === 0 && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: "oklch(0.65 0.04 145)" }}>
            Choose a prize template to get started:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TEMPLATE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.type}
                  onClick={() => onSelectTemplate(opt.type)}
                  className="flex items-start gap-2.5 p-3 rounded-xl text-left transition-all hover:scale-[1.02]"
                  style={{
                    background: "oklch(0.18 0.03 145)",
                    border: "1px solid oklch(0.28 0.04 145)",
                  }}
                >
                  <Icon size={16} style={{ color: "oklch(0.75 0.15 85)", marginTop: 2 }} />
                  <div>
                    <div className="text-xs font-semibold" style={{ color: "oklch(0.90 0.02 145)" }}>
                      {opt.label}
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: "oklch(0.55 0.04 145)" }}>
                      {opt.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Prize Slots by Section */}
      {prizes.length > 0 && (
        <div className="space-y-2">
          {/* Active template badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: "oklch(0.25 0.06 145)", color: "oklch(0.75 0.10 145)" }}>
              Template: {TEMPLATE_OPTIONS.find((t) => t.type === activeTemplate)?.label || "Custom"}
            </span>
            {allAssigned && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
                style={{ background: "oklch(0.25 0.08 145)", color: "oklch(0.80 0.15 145)" }}>
                <Check size={9} /> All Assigned
              </span>
            )}
          </div>

          {/* Section cards */}
          {sections.map((section) => {
            const sectionPrizes = prizesBySection.get(section.id) || [];
            const isExpanded = expandedSection === section.id;

            return (
              <div
                key={section.id}
                className="rounded-xl overflow-hidden"
                style={{ background: "oklch(0.16 0.03 145)", border: "1px solid oklch(0.25 0.04 145)" }}
              >
                {/* Section header */}
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: "oklch(0.88 0.02 145)" }}>
                      {section.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md"
                      style={{ background: "oklch(0.22 0.04 145)", color: "oklch(0.60 0.04 145)" }}>
                      {sectionPrizes.length} prize{sectionPrizes.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp size={14} style={{ color: "oklch(0.55 0.04 145)" }} /> : <ChevronDown size={14} style={{ color: "oklch(0.55 0.04 145)" }} />}
                </button>

                {/* Expanded prize list */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2">
                    {sectionPrizes.map((prize) => (
                      <PrizeSlotCard
                        key={prize.id}
                        prize={prize}
                        section={section}
                        isEditing={editingPrize === prize.id}
                        onStartEdit={() => setEditingPrize(prize.id)}
                        onStopEdit={() => setEditingPrize(null)}
                        onUpdate={(updates) => onUpdatePrize(prize.id, updates)}
                        onRemove={() => onRemovePrize(prize.id)}
                      />
                    ))}
                    <button
                      onClick={() => onAddPrize(section.id)}
                      className="w-full py-1.5 rounded-lg text-[10px] font-medium transition-all hover:opacity-80"
                      style={{ border: "1px dashed oklch(0.30 0.04 145)", color: "oklch(0.55 0.04 145)" }}
                    >
                      + Add Prize
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Prize Slot Card ─────────────────────────────────────────────────────────

function PrizeSlotCard({
  prize,
  section,
  isEditing,
  onStartEdit,
  onStopEdit,
  onUpdate,
  onRemove,
}: {
  prize: PrizeSlot;
  section: Section;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onUpdate: (updates: Partial<PrizeSlot>) => void;
  onRemove: () => void;
}) {
  const typeOption = PRIZE_TYPE_OPTIONS.find((o) => o.value === prize.prizeType);
  const TypeIcon = typeOption?.icon || DollarSign;

  if (isEditing) {
    return (
      <div className="p-2.5 rounded-lg space-y-2" style={{ background: "oklch(0.20 0.03 145)" }}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] font-medium block mb-0.5" style={{ color: "oklch(0.55 0.04 145)" }}>Title</label>
            <input
              type="text"
              value={prize.prizeTitle}
              onChange={(e) => onUpdate({ prizeTitle: e.target.value })}
              className="w-full px-2 py-1 rounded text-xs"
              style={{ background: "oklch(0.14 0.02 145)", color: "oklch(0.90 0.02 145)", border: "1px solid oklch(0.30 0.04 145)" }}
            />
          </div>
          <div>
            <label className="text-[9px] font-medium block mb-0.5" style={{ color: "oklch(0.55 0.04 145)" }}>Value</label>
            <input
              type="text"
              value={prize.prizeValue}
              onChange={(e) => onUpdate({ prizeValue: e.target.value })}
              placeholder="e.g. $25"
              className="w-full px-2 py-1 rounded text-xs"
              style={{ background: "oklch(0.14 0.02 145)", color: "oklch(0.90 0.02 145)", border: "1px solid oklch(0.30 0.04 145)" }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] font-medium block mb-0.5" style={{ color: "oklch(0.55 0.04 145)" }}>Type</label>
            <select
              value={prize.prizeType}
              onChange={(e) => onUpdate({ prizeType: e.target.value as PrizeType })}
              className="w-full px-2 py-1 rounded text-xs"
              style={{ background: "oklch(0.14 0.02 145)", color: "oklch(0.90 0.02 145)", border: "1px solid oklch(0.30 0.04 145)" }}
            >
              {PRIZE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-medium block mb-0.5" style={{ color: "oklch(0.55 0.04 145)" }}>Sponsor</label>
            <input
              type="text"
              value={prize.sponsorName || ""}
              onChange={(e) => onUpdate({ sponsorName: e.target.value })}
              placeholder="Optional"
              className="w-full px-2 py-1 rounded text-xs"
              style={{ background: "oklch(0.14 0.02 145)", color: "oklch(0.90 0.02 145)", border: "1px solid oklch(0.30 0.04 145)" }}
            />
          </div>
        </div>
        {/* Manual winner override */}
        {prize.status === "pending" && section.standings.length > 0 && (
          <div>
            <label className="text-[9px] font-medium block mb-0.5" style={{ color: "oklch(0.55 0.04 145)" }}>Assign to</label>
            <select
              value={prize.assignedPlayerId || ""}
              onChange={(e) => {
                const player = section.standings.find((s) => s.playerId === e.target.value);
                if (player) {
                  onUpdate({ assignedPlayerId: player.playerId, assignedPlayerName: player.name, status: "assigned" });
                }
              }}
              className="w-full px-2 py-1 rounded text-xs"
              style={{ background: "oklch(0.14 0.02 145)", color: "oklch(0.90 0.02 145)", border: "1px solid oklch(0.30 0.04 145)" }}
            >
              <option value="">Auto (by placement)</option>
              {section.standings.map((s) => (
                <option key={s.playerId} value={s.playerId}>{s.name} (#{s.rank})</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          <button onClick={onStopEdit} className="text-[10px] font-medium px-2 py-1 rounded" style={{ background: "oklch(0.30 0.06 145)", color: "oklch(0.85 0.02 145)" }}>
            Done
          </button>
          <button onClick={onRemove} className="text-[10px] font-medium px-2 py-1 rounded" style={{ color: "oklch(0.60 0.10 25)" }}>
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all hover:opacity-90"
      style={{ background: "oklch(0.20 0.03 145)" }}
      onClick={onStartEdit}
    >
      <div className="flex items-center gap-2">
        <TypeIcon size={13} style={{ color: "oklch(0.75 0.15 85)" }} />
        <div>
          <div className="text-[11px] font-medium" style={{ color: "oklch(0.88 0.02 145)" }}>
            {prize.prizeTitle}
          </div>
          <div className="text-[9px]" style={{ color: "oklch(0.55 0.04 145)" }}>
            {prize.prizeValue || "No value set"}{prize.sponsorName ? ` • ${prize.sponsorName}` : ""}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {prize.status === "assigned" && prize.assignedPlayerName && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium"
            style={{ background: "oklch(0.25 0.08 145)", color: "oklch(0.80 0.12 145)" }}>
            → {prize.assignedPlayerName}
          </span>
        )}
        {prize.status === "pending" && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-md"
            style={{ background: "oklch(0.25 0.06 50)", color: "oklch(0.70 0.10 50)" }}>
            Pending
          </span>
        )}
      </div>
    </div>
  );
}
