/**
 * PartoCRS flight integration — adapter contract (FLIGHTS ONLY).
 *
 * UI code depends only on `FlightSupplierAdapter`. Today the app uses `MockPartoFlightAdapter`
 * (no network). In production, swap in `BackendPartoFlightAdapter`, which calls OUR protected
 * backend; the backend (not the browser) holds supplier credentials and talks to PartoCRS.
 * No supplier credentials, tokens or auth scheme are assumed or embedded here.
 */
import type { PartoFlightOperation, PartoFlightOperations } from "./types";

export type FlightRequest<K extends PartoFlightOperation> = PartoFlightOperations[K]["request"];
export type FlightResponse<K extends PartoFlightOperation> = PartoFlightOperations[K]["response"];

export interface AdapterResult<T> {
  data: T;
  /** True for simulated responses; the UI must label them as demonstration results. */
  isDemo: boolean;
}

export interface FlightSupplierAdapter {
  readonly name: string;
  call<K extends PartoFlightOperation>(op: K, request: FlightRequest<K>): Promise<AdapterResult<FlightResponse<K>>>;
}

/**
 * Future production adapter: POSTs to the app's own protected backend route
 * (e.g. `/api/integrations/partocrs/<operation>`). Disabled until that backend exists,
 * so no live reservation, ticket, cancellation or refund can be triggered in this phase.
 */
export class BackendPartoFlightAdapter implements FlightSupplierAdapter {
  readonly name = "PartoCRS (backend)";
  constructor(private readonly baseUrl: string | null = null) {}
  async call<K extends PartoFlightOperation>(op: K, request: FlightRequest<K>): Promise<AdapterResult<FlightResponse<K>>> {
    if (!this.baseUrl) {
      throw new Error(`PartoCRS backend is not configured; ${op} was not sent.`);
    }
    const res = await fetch(`${this.baseUrl}/${op}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(request),
    });
    if (!res.ok) throw new Error(`${op} failed with HTTP ${res.status}`);
    return { data: (await res.json()) as FlightResponse<K>, isDemo: false };
  }
}
