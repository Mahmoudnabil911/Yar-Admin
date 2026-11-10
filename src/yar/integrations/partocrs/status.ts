/**
 * Keeps four distinct status dimensions apart:
 *  - local booking status (YAR workflow: awaiting / processing / issued / cancelled)
 *  - supplier reservation status (PartoCRS AirQueueStatus)
 *  - ticket issuance status (derived; only "ticketed" once the supplier confirms)
 *  - customer payment status (YAR manual collections; unrelated to the supplier)
 */
import { AirQueueStatus } from "./types";

export type TicketIssuance = "not_requested" | "in_process" | "ticketed" | "voided_or_cancelled" | "exception";

export function ticketIssuanceOf(status: AirQueueStatus | null | undefined): TicketIssuance {
  switch (status) {
    case AirQueueStatus.TicketinProcess:
      return "in_process";
    case AirQueueStatus.Ticketed:
    case AirQueueStatus.TicketedChanged:
    case AirQueueStatus.TicketedScheduleChange:
      return "ticketed";
    case AirQueueStatus.TicketedCancelled:
    case AirQueueStatus.TicketedVoid:
      return "voided_or_cancelled";
    case AirQueueStatus.Exception:
    case AirQueueStatus.Gateway:
    case AirQueueStatus.Duplicate:
      return "exception";
    default:
      return "not_requested";
  }
}

/** A reservation is never presented as ticketed unless the supplier status confirms issuance. */
export function isTicketed(status: AirQueueStatus | null | undefined): boolean {
  return ticketIssuanceOf(status) === "ticketed";
}

/** Price change detection between search and revalidation; the user must explicitly accept. */
export function priceChanged(before: number | undefined, after: number | undefined): boolean {
  if (before === undefined || after === undefined) return false;
  return Math.abs(after - before) > 0.009;
}
