import "server-only";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { newId } from "@/lib/ids";
import { siteUrl } from "@/lib/mail";

export type CheckoutInput = {
  orderId: string;
  orderCode: string;
  amountBani: number;
  description: string;
  buyerEmail?: string | null;
  buyerName: string;
};

export type CheckoutResult = {
  paymentId: string;
  redirectUrl: string;
};

// Orice procesator (Netopia, EuPlătesc, PayU, Stripe) se leagă aici.
// Banii intră în contul firmei; registrul pe organizator îi ține evidența.
export interface PaymentProvider {
  readonly id: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  refund(paymentId: string, amountBani: number): Promise<{ ok: boolean; providerRef?: string; error?: string }>;
}

// Procesatorul "demo": nicio plată reală. Pagina /plata-demo lasă testerul să
// aleagă dacă plata reușește sau nu. Este marcat clar în interfață.
const demoProvider: PaymentProvider = {
  id: "demo",
  async createCheckout(input) {
    const paymentId = newId();
    await db.insert(payments).values({
      id: paymentId,
      orderId: input.orderId,
      provider: "demo",
      providerRef: `demo_${input.orderCode}`,
      amountBani: input.amountBani,
      status: "created",
      raw: { description: input.description },
    });
    return { paymentId, redirectUrl: siteUrl(`/plata-demo/${paymentId}`) };
  },
  async refund() {
    return { ok: true, providerRef: `demo_refund_${Date.now()}` };
  },
};

export function getPaymentProvider(): PaymentProvider {
  const wanted = process.env.PAYMENT_PROVIDER ?? "demo";
  switch (wanted) {
    case "demo":
      return demoProvider;
    default:
      throw new Error(`Procesator de plăți necunoscut: ${wanted}`);
  }
}

export function isDemoPayments(): boolean {
  return (process.env.PAYMENT_PROVIDER ?? "demo") === "demo";
}
