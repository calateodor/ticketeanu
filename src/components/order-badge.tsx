import { Badge } from "./ui";

export function OrderBadge({ status }: { status: string }) {
  switch (status) {
    case "confirmed":
      return <Badge tone="ok">Confirmată</Badge>;
    case "pending":
      return <Badge tone="warn">Așteaptă plata</Badge>;
    case "refunded":
      return <Badge tone="danger">Rambursată</Badge>;
    case "cancelled":
      return <Badge tone="danger">Anulată</Badge>;
    default:
      return <Badge>Expirată</Badge>;
  }
}
