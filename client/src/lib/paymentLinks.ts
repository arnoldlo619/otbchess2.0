export type PaymentMethod = "venmo" | "cashapp" | "paypal";

export interface PaymentLinkValues {
  paymentVenmo?: string | null;
  paymentCashapp?: string | null;
  paymentPaypal?: string | null;
  paymentVenmoQrUrl?: string | null;
  paymentCashappQrUrl?: string | null;
  paymentPaypalQrUrl?: string | null;
}

export type PaymentLinkErrors = Partial<Record<PaymentMethod, string>>;

const paymentRules: Record<PaymentMethod, { label: string; hosts: string[]; pathHint: string }> = {
  venmo: {
    label: "Venmo",
    hosts: ["venmo.com"],
    pathHint: "Use a complete https://venmo.com/... link.",
  },
  cashapp: {
    label: "Cash App",
    hosts: ["cash.app"],
    pathHint: "Use a complete https://cash.app/$... link.",
  },
  paypal: {
    label: "PayPal",
    hosts: ["paypal.me", "paypal.com"],
    pathHint: "Use a complete https://paypal.me/... or https://paypal.com/... link.",
  },
};

export function validatePaymentLink(method: PaymentMethod, value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return undefined;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return `${paymentRules[method].label} must be a complete secure URL. ${paymentRules[method].pathHint}`;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  const supportedHost = paymentRules[method].hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  if (url.protocol !== "https:" || !supportedHost || url.pathname === "/") {
    return `${paymentRules[method].label} link is not supported. ${paymentRules[method].pathHint}`;
  }

  if (method === "cashapp" && !url.pathname.startsWith("/$")) {
    return "Cash App links must include the cashtag, for example https://cash.app/$chessclub.";
  }

  return undefined;
}

export function validatePaymentLinks(values: PaymentLinkValues): PaymentLinkErrors {
  const errors: PaymentLinkErrors = {};
  const venmo = validatePaymentLink("venmo", values.paymentVenmo);
  const cashapp = validatePaymentLink("cashapp", values.paymentCashapp);
  const paypal = validatePaymentLink("paypal", values.paymentPaypal);
  if (venmo) errors.venmo = venmo;
  if (cashapp) errors.cashapp = cashapp;
  if (paypal) errors.paypal = paypal;
  return errors;
}

export function hasValidPaymentLinks(values: PaymentLinkValues): boolean {
  return Object.keys(validatePaymentLinks(values)).length === 0;
}
