import { useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CreditCard, GripVertical, ImagePlus, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PlayerPaymentMethods } from "@/components/tournament/PlayerPaymentMethods";
import {
  normalizePaymentMethodOrder,
  validatePaymentLinks,
  type PaymentMethod,
} from "@/lib/paymentLinks";

export interface TournamentPaymentSettingsValue {
  paymentVenmo: string;
  paymentCashapp: string;
  paymentPaypal: string;
  paymentVenmoEnabled: boolean;
  paymentCashappEnabled: boolean;
  paymentPaypalEnabled: boolean;
  paymentVenmoQrUrl: string;
  paymentCashappQrUrl: string;
  paymentPaypalQrUrl: string;
  paymentInstructions: string;
  paymentMethodOrder: PaymentMethod[];
}

type Props = {
  value: TournamentPaymentSettingsValue;
  onChange: (patch: Partial<TournamentPaymentSettingsValue>) => void;
  isDark: boolean;
  disabled?: boolean;
};

const PAYMENT_METHOD_DETAILS: Record<PaymentMethod, { label: "Venmo" | "Cash App" | "PayPal"; placeholder: string }> = {
  venmo: { label: "Venmo", placeholder: "https://venmo.com/..." },
  cashapp: { label: "Cash App", placeholder: "https://cash.app/$..." },
  paypal: { label: "PayPal", placeholder: "https://paypal.me/..." },
};

function readPaymentQrImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image"));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

function PaymentMethodToggle({ method, enabled, onChange, isDark, disabled }: {
  method: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  isDark: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      data-payment-method-toggle={method.toLowerCase().replace(/\s+/g, "-")}
      className="flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] disabled:cursor-not-allowed"
      style={{
        background: enabled ? (isDark ? "rgba(76,175,80,0.15)" : "rgba(76,175,80,0.10)") : (isDark ? "rgba(255,255,255,0.04)" : "rgba(67,104,80,0.05)"),
        borderColor: enabled ? (isDark ? "rgba(76,175,80,0.42)" : "rgba(47,132,74,0.35)") : (isDark ? "rgba(255,255,255,0.10)" : "rgba(67,104,80,0.15)"),
        color: isDark ? "rgba(255,255,255,0.88)" : "#12372A",
      }}
    >
      <span className="min-w-0 truncate">{method}</span>
      <span className="flex shrink-0 items-center gap-2.5" aria-hidden="true">
        <span className="text-xs font-semibold" style={{ color: enabled ? "#4CAF50" : (isDark ? "rgba(255,255,255,0.42)" : "#6B7280") }}>{enabled ? "On" : "Off"}</span>
        <span className="flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors" style={{ background: enabled ? "#4CAF50" : (isDark ? "rgba(255,255,255,0.20)" : "#9CA3AF") }}>
          <span className="h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200" style={{ transform: enabled ? "translateX(20px)" : "translateX(0)" }} />
        </span>
      </span>
    </button>
  );
}

function PaymentQrUpload({ method, value, onChange, isDark, disabled }: {
  method: "Venmo" | "Cash App" | "PayPal";
  value: string;
  onChange: (value: string) => void;
  isDark: boolean;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const border = isDark ? "rgba(123,220,145,0.18)" : "rgba(47,132,74,0.18)";

  const handleFile = async (file?: File) => {
    if (!file || disabled) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error("Upload a PNG, JPEG, or WebP QR image.");
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      toast.error("QR image must be 1.5 MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      onChange(await readPaymentQrImage(file));
      toast.success(`${method} QR image added.`);
    } catch {
      toast.error("Unable to read that QR image. Please try another file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border p-2.5" style={{ background: isDark ? "rgba(5,22,12,0.44)" : "rgba(255,255,255,0.56)", borderColor: border }}>
      <input ref={inputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={(event) => void handleFile(event.target.files?.[0])} aria-label={`Upload ${method} QR code image`} />
      {value ? (
        <div className="flex items-center gap-2">
          <img src={value} alt={`${method} payment QR preview`} className="h-10 w-10 rounded-lg border bg-white object-contain p-0.5" style={{ borderColor: border }} />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold" style={{ color: isDark ? "#FFFFFF" : "#12372A" }}>{method} QR ready</span>
          <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} className="rounded-md p-1.5 transition-colors hover:bg-emerald-500/10 disabled:cursor-not-allowed" aria-label={`Replace ${method} QR image`}><ImagePlus className="h-3.5 w-3.5" style={{ color: "#4CAF50" }} /></button>
          <button type="button" disabled={disabled} onClick={() => onChange("")} className="rounded-md p-1.5 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed" aria-label={`Remove ${method} QR image`}><Trash2 className="h-3.5 w-3.5" style={{ color: isDark ? "#fca5a5" : "#b91c1c" }} /></button>
        </div>
      ) : (
        <button type="button" disabled={disabled || uploading} onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition-colors hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60" style={{ color: "#4CAF50" }}>
          <ImagePlus className="h-3.5 w-3.5" />{uploading ? "Reading QR…" : `Upload ${method} QR`}
        </button>
      )}
    </div>
  );
}

function SortablePaymentMethodCard({ method, enabled, isDark }: { method: PaymentMethod; enabled: boolean; isDark: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: method });
  const detail = PAYMENT_METHOD_DETAILS[method];
  return (
    <div ref={setNodeRef} className={`flex items-center gap-2 rounded-xl border p-2.5 transition-opacity ${enabled ? "" : "opacity-55"}`} style={{ transform: CSS.Transform.toString(transform), transition, background: isDark ? "rgba(5,22,12,0.24)" : "rgba(255,255,255,0.32)", borderColor: isDragging ? "rgba(76,175,80,0.75)" : isDark ? "rgba(123,220,145,0.16)" : "rgba(47,132,74,0.16)", boxShadow: isDragging ? "0 16px 32px rgba(0,0,0,0.24)" : "none", zIndex: isDragging ? 10 : undefined }}>
      <button type="button" className="flex h-8 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg transition-colors hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] active:cursor-grabbing" style={{ color: isDark ? "rgba(255,255,255,0.48)" : "#436850" }} aria-label={`Reorder ${detail.label}`} {...attributes} {...listeners}><GripVertical className="h-4 w-4" aria-hidden="true" /></button>
      <div className="min-w-0 flex-1"><p className="text-xs font-bold" style={{ color: isDark ? "#FFFFFF" : "#12372A" }}>{detail.label}</p><p className="text-[11px]" style={{ color: isDark ? "rgba(255,255,255,0.38)" : "#436850" }}>{enabled ? "Enabled for players" : "Currently disabled"}</p></div>
      <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: isDark ? "rgba(255,255,255,0.30)" : "#6B7280" }}>Drag</span>
    </div>
  );
}

export function TournamentPaymentSettings({ value, onChange, isDark, disabled }: Props) {
  const order = normalizePaymentMethodOrder(value.paymentMethodOrder);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const errors = Object.values(validatePaymentLinks(value));
  const entries = [
    { method: "venmo" as const, value: value.paymentVenmo, enabled: value.paymentVenmoEnabled, qr: value.paymentVenmoQrUrl, update: (patch: Partial<TournamentPaymentSettingsValue>) => onChange(patch), fields: { url: "paymentVenmo" as const, enabled: "paymentVenmoEnabled" as const, qr: "paymentVenmoQrUrl" as const } },
    { method: "cashapp" as const, value: value.paymentCashapp, enabled: value.paymentCashappEnabled, qr: value.paymentCashappQrUrl, update: (patch: Partial<TournamentPaymentSettingsValue>) => onChange(patch), fields: { url: "paymentCashapp" as const, enabled: "paymentCashappEnabled" as const, qr: "paymentCashappQrUrl" as const } },
    { method: "paypal" as const, value: value.paymentPaypal, enabled: value.paymentPaypalEnabled, qr: value.paymentPaypalQrUrl, update: (patch: Partial<TournamentPaymentSettingsValue>) => onChange(patch), fields: { url: "paymentPaypal" as const, enabled: "paymentPaypalEnabled" as const, qr: "paymentPaypalQrUrl" as const } },
  ];

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (disabled || !over || active.id === over.id) return;
    const from = order.indexOf(active.id as PaymentMethod);
    const to = order.indexOf(over.id as PaymentMethod);
    if (from >= 0 && to >= 0) onChange({ paymentMethodOrder: arrayMove(order, from, to) });
  };

  return (
    <section aria-labelledby="player-payments-heading" className="rounded-xl border overflow-hidden" style={{ background: isDark ? "oklch(0.22 0.06 145)" : "#FFFFFF", borderColor: isDark ? "rgba(255,255,255,0.10)" : "#E5E7EB" }}>
      <div className="border-b px-5 py-4" style={{ borderColor: isDark ? "rgba(255,255,255,0.10)" : "#F0F0F0" }}>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: isDark ? "rgba(123,220,145,0.13)" : "rgba(47,132,74,0.11)", color: "#4CAF50" }}><CreditCard className="h-4 w-4" aria-hidden="true" /></span>
          <div><h3 id="player-payments-heading" className="text-sm font-bold" style={{ color: isDark ? "#FFFFFF" : "#12372A" }}>Player payments</h3><p className="mt-1 text-xs leading-relaxed" style={{ color: isDark ? "rgba(255,255,255,0.48)" : "#436850" }}>Optionally share direct payment links and QR codes with registered players.</p></div>
        </div>
      </div>
      <div className="space-y-4 px-5 py-4">
        <div className="grid gap-3 lg:grid-cols-3">
          {entries.map((entry) => {
            const detail = PAYMENT_METHOD_DETAILS[entry.method];
            return <div key={entry.method} className={`space-y-2 ${entry.enabled ? "" : "opacity-55"}`}>
              <PaymentMethodToggle method={detail.label} enabled={entry.enabled} onChange={(enabled) => entry.update({ [entry.fields.enabled]: enabled })} isDark={isDark} disabled={disabled} />
              <label className="sr-only" htmlFor={`payment-link-${entry.method}`}>{detail.label} payment link</label>
              <div className="relative"><Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden="true" style={{ color: isDark ? "rgba(255,255,255,0.38)" : "#6B7280" }} /><input id={`payment-link-${entry.method}`} type="url" disabled={disabled || !entry.enabled} value={entry.value} onChange={(event) => entry.update({ [entry.fields.url]: event.target.value })} placeholder={detail.placeholder} className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#4CAF50] focus:ring-2 focus:ring-[#4CAF50]/20 disabled:cursor-not-allowed" style={{ background: isDark ? "oklch(0.25 0.07 145)" : "#FFFFFF", color: isDark ? "#FFFFFF" : "#12372A", borderColor: isDark ? "rgba(255,255,255,0.12)" : "#D1D5DB" }} /></div>
              <PaymentQrUpload method={detail.label} value={entry.qr} onChange={(qr) => entry.update({ [entry.fields.qr]: qr })} isDark={isDark} disabled={disabled || !entry.enabled} />
            </div>;
          })}
        </div>
        {errors.length > 0 && <div role="alert" className="rounded-xl border px-3 py-2.5 text-xs leading-relaxed" style={{ background: isDark ? "rgba(239,68,68,0.10)" : "#FEF2F2", borderColor: isDark ? "rgba(248,113,113,0.35)" : "#FECACA", color: isDark ? "#FCA5A5" : "#B91C1C" }}><p className="font-bold">Fix payment links before saving</p><ul className="mt-1 list-disc space-y-0.5 pl-4">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
        <div className="rounded-xl border p-3" style={{ borderColor: isDark ? "rgba(123,220,145,0.16)" : "rgba(47,132,74,0.16)", background: isDark ? "rgba(5,22,12,0.24)" : "rgba(71,173,98,0.05)" }}>
          <p className="text-xs font-bold" style={{ color: isDark ? "#FFFFFF" : "#12372A" }}>Display order and instructions</p><p className="mt-1 text-xs" style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#436850" }}>Drag methods to prioritize them on registration, then add any payment details players should include.</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><SortableContext items={order} strategy={rectSortingStrategy}><div className="mt-3 grid gap-2 sm:grid-cols-3">{order.map((method) => <SortablePaymentMethodCard key={method} method={method} enabled={method === "venmo" ? value.paymentVenmoEnabled : method === "cashapp" ? value.paymentCashappEnabled : value.paymentPaypalEnabled} isDark={isDark} />)}</div></SortableContext></DndContext>
          <label className="mt-4 block text-xs font-semibold" style={{ color: isDark ? "rgba(255,255,255,0.58)" : "#436850" }}>Payment instructions <span className="font-normal opacity-70">optional</span><textarea disabled={disabled} value={value.paymentInstructions} onChange={(event) => onChange({ paymentInstructions: event.target.value })} placeholder="e.g. Include your USCF ID and tournament name in the payment note. Please pay before your first round." rows={3} className="mt-1.5 w-full resize-none rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:border-[#4CAF50] focus:ring-2 focus:ring-[#4CAF50]/20 disabled:cursor-not-allowed" style={{ background: isDark ? "oklch(0.25 0.07 145)" : "#FFFFFF", color: isDark ? "#FFFFFF" : "#12372A", borderColor: isDark ? "rgba(255,255,255,0.12)" : "#D1D5DB" }} /></label>
        </div>
        <div className="border-t pt-4" style={{ borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(47,132,74,0.15)" }}><p className="mb-2 text-xs font-bold uppercase tracking-[0.12em]" style={{ color: isDark ? "rgba(255,255,255,0.38)" : "#6B7280" }}>Player registration preview</p><PlayerPaymentMethods payments={value} preview isDark={isDark} /></div>
      </div>
    </section>
  );
}
