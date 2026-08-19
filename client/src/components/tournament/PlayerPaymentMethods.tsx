import { ExternalLink, QrCode, WalletCards } from "lucide-react";
import { normalizePaymentMethodOrder, type PaymentLinkValues, type PaymentMethod } from "@/lib/paymentLinks";

type PaymentMethodDisplay = {
  key: "venmo" | "cashapp" | "paypal";
  label: string;
  url: string;
  qrUrl: string;
};

function methodsFrom(values: PaymentLinkValues): PaymentMethodDisplay[] {
  const methodsByKey: Record<PaymentMethod, PaymentMethodDisplay> = {
    venmo: { key: "venmo", label: "Venmo", url: values.paymentVenmoEnabled === false ? "" : values.paymentVenmo?.trim() ?? "", qrUrl: values.paymentVenmoEnabled === false ? "" : values.paymentVenmoQrUrl ?? "" },
    cashapp: { key: "cashapp", label: "Cash App", url: values.paymentCashappEnabled === false ? "" : values.paymentCashapp?.trim() ?? "", qrUrl: values.paymentCashappEnabled === false ? "" : values.paymentCashappQrUrl ?? "" },
    paypal: { key: "paypal", label: "PayPal", url: values.paymentPaypalEnabled === false ? "" : values.paymentPaypal?.trim() ?? "", qrUrl: values.paymentPaypalEnabled === false ? "" : values.paymentPaypalQrUrl ?? "" },
  };
  return normalizePaymentMethodOrder(values.paymentMethodOrder)
    .map((method) => methodsByKey[method])
    .filter((method) => method.url || method.qrUrl);
}

export function PlayerPaymentMethods({
  payments,
  preview = false,
  isDark = true,
}: {
  payments: PaymentLinkValues;
  preview?: boolean;
  isDark?: boolean;
}) {
  const methods = methodsFrom(payments);
  const instructions = payments.paymentInstructions?.trim();
  if (methods.length === 0 && !preview) return null;

  const text = isDark ? "text-white" : "text-[#12372A]";
  const muted = isDark ? "text-white/55" : "text-[#436850]/70";
  const surface = isDark ? "bg-white/[0.055] border-white/10" : "bg-[#F7FAF8] border-[#436850]/15";

  return (
    <section className={`rounded-2xl border p-4 ${surface}`} aria-label={preview ? "Player payment preview" : "Entry payment options"}>
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isDark ? "bg-[#4CAF50]/15" : "bg-[#436850]/10"}`}>
          <WalletCards className="h-4 w-4 text-[#4CAF50]" />
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-bold ${text}`}>{preview ? "Player registration preview" : "Pay entry fee"}</p>
          <p className={`mt-0.5 text-xs leading-relaxed ${muted}`}>
            {methods.length > 0 ? "Pay the host directly with one of the methods below." : "Add a valid payment link or QR image to preview the player payment card."}
          </p>
        </div>
      </div>

      {instructions && (
        <div className={`mt-3 rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${isDark ? "border-white/10 bg-black/10 text-white/75" : "border-[#436850]/12 bg-white text-[#436850]/85"}`}>
          <span className={`mr-1 font-bold ${text}`}>Host note:</span>
          {instructions}
        </div>
      )}

      {methods.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {methods.map((method) => (
            <div key={method.key} className={`rounded-xl border p-3 ${isDark ? "border-white/10 bg-black/10" : "border-[#436850]/12 bg-white"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-bold ${text}`}>{method.label}</span>
                {method.qrUrl && <QrCode className={`h-3.5 w-3.5 ${muted}`} aria-label={`${method.label} QR available`} />}
              </div>
              {method.qrUrl && (
                <img src={method.qrUrl} alt={`${method.label} payment QR code`} className="mt-2 h-20 w-20 rounded-lg border border-black/10 bg-white object-contain p-1" />
              )}
              {method.url && (
                preview ? (
                  <span className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-[#4CAF50] px-2 py-2 text-xs font-bold text-white">
                    Pay with {method.label}<ExternalLink className="h-3 w-3" />
                  </span>
                ) : (
                  <a href={method.url} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-[#4CAF50] px-2 py-2 text-xs font-bold text-white transition-colors hover:bg-[#3f9d4a]">
                    Pay with {method.label}<ExternalLink className="h-3 w-3" />
                  </a>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
