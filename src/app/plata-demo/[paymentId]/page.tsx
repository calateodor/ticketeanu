import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events, orders, payments } from "@/db/schema";
import { nowMs } from "@/lib/dates";
import { formatLei } from "@/lib/money";
import { markPaymentFailed, markPaymentPaid } from "@/lib/orders";
import { isDemoPayments } from "@/lib/payments";
import { Button, Logo } from "@/components/ui";

export const metadata = { title: "Plată simulată" };

export default async function DemoPaymentPage({ params }: PageProps<"/plata-demo/[paymentId]">) {
  if (!isDemoPayments()) notFound();
  const { paymentId } = await params;
  const [row] = await db
    .select({ payment: payments, order: orders, event: events })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .innerJoin(events, eq(events.id, orders.eventId))
    .where(eq(payments.id, paymentId))
    .limit(1);
  if (!row) notFound();
  const { payment, order, event } = row;
  if (payment.status === "paid") redirect(`/comanda/${order.manageToken}`);

  async function succeed() {
    "use server";
    const res = await markPaymentPaid(paymentId, `demo_ok_${nowMs()}`, { outcome: "paid" });
    redirect(res ? `/comanda/${res.orderManageToken}?nou=1` : "/");
  }
  async function fail() {
    "use server";
    const res = await markPaymentFailed(paymentId, { outcome: "failed" });
    redirect(res ? `/comanda/${res.orderManageToken}` : "/");
  }

  return (
    <div className="min-h-dvh">
      <header className="max-w-md mx-auto px-4 py-4">
        <Link href="/">
          <Logo />
        </Link>
      </header>
      <main className="max-w-md mx-auto px-4 pb-12">
        <div className="rounded-(--radius-card) bg-surface border border-line p-6">
          <p className="inline-block rounded-full bg-warn-soft text-[#854f0b] text-xs font-semibold px-3 py-1">Plată simulată · fără bani reali</p>
          <h1 className="text-2xl font-extrabold mt-3">Pagina procesatorului de plăți</h1>
          <p className="text-muted mt-1 text-sm">
            Aici va fi pagina sigură a procesatorului (card, Apple Pay, Google Pay). Până la contractul cu procesatorul, alegi tu rezultatul plății.
          </p>
          <dl className="mt-5 text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted">Eveniment</dt>
            <dd className="font-semibold">{event.title}</dd>
            <dt className="text-muted">Comanda</dt>
            <dd className="font-mono">{order.code}</dd>
            <dt className="text-muted">De plată</dt>
            <dd className="font-display font-extrabold text-xl">{formatLei(payment.amountBani)}</dd>
          </dl>
          <div className="mt-6 grid gap-2">
            <form action={succeed}>
              <Button type="submit" size="lg" className="w-full">
                Simulează plata reușită
              </Button>
            </form>
            <form action={fail}>
              <Button type="submit" size="lg" variant="secondary" className="w-full">
                Simulează plata eșuată
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
