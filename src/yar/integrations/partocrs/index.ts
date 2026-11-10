export * from "./types";
export * from "./adapter";
export * from "./status";
export { MockPartoFlightAdapter } from "./mockAdapter";

import { MockPartoFlightAdapter } from "./mockAdapter";
import type { FlightSupplierAdapter } from "./adapter";

/** Single place to swap the mock for `new BackendPartoFlightAdapter('/api/integrations/partocrs')`. */
export const flightAdapter: FlightSupplierAdapter = new MockPartoFlightAdapter();
