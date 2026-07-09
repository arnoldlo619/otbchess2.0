/**
 * ClubBackgroundPicker — 5-template background image selector for club pages.
 *
 * Renders a horizontal scroll grid of thumbnail cards. Selecting a template
 * calls onSelect with the /manus-storage path. A "None" option resets to the
 * default micro-grid pattern.
 */
import React from "react";
import { Check, X } from "lucide-react";

export interface BackgroundTemplate {
  id: string;
  label: string;
  path: string;
}

export const CLUB_BACKGROUND_TEMPLATES: BackgroundTemplate[] = [
  {
    id: "floating-board",
    label: "Floating Board",
    path: "/manus-storage/719a4794-06af-4479-a366-8836df058745_ef79895f.png",
  },
  {
    id: "ink-splash",
    label: "Ink Splash",
    path: "/manus-storage/ce30490c-4487-4d1d-810f-62abbe9324e9_68b08db6.png",
  },
  {
    id: "crimson-arena",
    label: "Crimson Arena",
    path: "/manus-storage/54abdfe5-4277-42cc-aa2c-ee5e604604cf_917b5e1d.png",
  },
  {
    id: "levitation",
    label: "Levitation",
    path: "/manus-storage/22d2cdca-1e2b-4322-83b3-193e2c6667cf_b7715d25.png",
  },
  {
    id: "time-kings",
    label: "Time & Kings",
    path: "/manus-storage/ChatGPTImageJul8,2026,06_55_27PM_5f2ba96c.png",
  },
];

interface ClubBackgroundPickerProps {
  value: string | null | undefined;
  onChange: (path: string | null) => void;
  accent?: string;
}

export function ClubBackgroundPicker({
  value,
  onChange,
  accent = "#4CAF50",
}: ClubBackgroundPickerProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
        Club Background
      </p>

      {/* Scrollable template grid */}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
        {/* None option */}
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`relative flex-shrink-0 snap-start rounded-xl overflow-hidden border-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            !value
              ? "border-[--accent] shadow-lg scale-[1.03]"
              : "border-white/10 hover:border-white/30"
          }`}
          style={{
            width: 120,
            height: 72,
            borderColor: !value ? accent : undefined,
          // @ts-expect-error -- CSS custom property not in CSSProperties type
              "--accent": accent,
          }}
          aria-label="No background — use default pattern"
          aria-pressed={!value}
        >
          {/* Micro-grid preview */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(rgba(118,255,136,0.07) 1px, transparent 1px),
                linear-gradient(90deg, rgba(118,255,136,0.07) 1px, transparent 1px)
              `,
              backgroundSize: "14px 14px",
              background: "linear-gradient(135deg, rgba(10,45,20,0.96), rgba(2,12,6,0.98))",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(rgba(118,255,136,0.07) 1px, transparent 1px),
                linear-gradient(90deg, rgba(118,255,136,0.07) 1px, transparent 1px)
              `,
              backgroundSize: "14px 14px",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white/60 tracking-wider uppercase">
              Default
            </span>
          </div>
          {!value && (
            <div
              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: accent }}
            >
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
          )}
        </button>

        {/* Template cards */}
        {CLUB_BACKGROUND_TEMPLATES.map((tpl) => {
          const selected = value === tpl.path;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onChange(tpl.path)}
              className={`relative flex-shrink-0 snap-start rounded-xl overflow-hidden border-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                selected
                  ? "shadow-lg scale-[1.03]"
                  : "border-white/10 hover:border-white/30"
              }`}
              style={{
                width: 120,
                height: 72,
                borderColor: selected ? accent : undefined,
              }}
              aria-label={tpl.label}
              aria-pressed={selected}
            >
              <img
                src={tpl.path}
                alt={tpl.label}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
              {/* Label scrim */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
                <span className="text-[9px] font-semibold text-white/90 tracking-wide">
                  {tpl.label}
                </span>
              </div>
              {/* Selected checkmark */}
              {selected && (
                <div
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: accent }}
                >
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Clear button when a template is active */}
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Remove background
        </button>
      )}
    </div>
  );
}
