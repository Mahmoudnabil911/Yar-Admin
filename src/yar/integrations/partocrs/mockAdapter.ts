/**
 * Deterministic mock of the PartoCRS flight operations. Shapes follow swagger.json exactly;
 * values are invented demo data and always flagged `isDemo: true`. Never touches the network.
 */
import {
  AirQueueCategory,
  AirQueueStatus,
  AirTripType,
  CabinType,
  FareType,
  RefundMethod,
  RefundType,
  type PricedItinerary,
} from "./types";
import type { AdapterResult, FlightRequest, FlightResponse, FlightSupplierAdapter } from "./adapter";
import type { PartoFlightOperation } from "./types";

type Booking = {
  UniqueId: string;
  ClientUniqueId: string | null;
  FareSourceCode: string;
  Status: AirQueueStatus;
  Category: AirQueueCategory;
  TktTimeLimit: string;
  Notes: string[];
  Total: number;
  Currency: string;
};

const AIRLINES = [
  { code: "IA", flight: "IA236", dep: "08:10", arr: "10:05", base: 180 },
  { code: "W5", flight: "W5115", dep: "13:30", arr: "15:40", base: 205 },
  { code: "EP", flight: "EP902", dep: "21:15", arr: "23:20", base: 162 },
];

function iso(date: string, time: string) {
  return `${date.slice(0, 10)}T${time}:00`;
}

export class MockPartoFlightAdapter implements FlightSupplierAdapter {
  readonly name = "PartoCRS (mock)";
  private searchSeq = 9100;
  private bookings = new Map<string, Booking>();
  private fares = new Map<string, PricedItinerary>();
  /** Fare codes whose price changes on revalidation (to exercise the price-change flow). */
  private repriced = new Set<string>();
  /** Total network requests made by this adapter — always 0. */
  readonly networkCalls = 0;

  private ok<T>(data: T): Promise<AdapterResult<T>> {
    return Promise.resolve({ data, isDemo: true });
  }

  call<K extends PartoFlightOperation>(op: K, request: FlightRequest<K>): Promise<AdapterResult<FlightResponse<K>>> {
    const handler = (this as unknown as Record<string, (r: unknown) => Promise<AdapterResult<unknown>>>)[`do${op}`];
    if (!handler) return Promise.reject(new Error(`Unsupported operation ${op}`));
    return handler.call(this, request) as Promise<AdapterResult<FlightResponse<K>>>;
  }

  protected doAirLowFareSearch(r: FlightRequest<"AirLowFareSearch">) {
    const legs = r.OriginDestinationInformations ?? [];
    const searchId = ++this.searchSeq;
    const pax = (r.AdultCount ?? 1) + (r.ChildCount ?? 0);
    const itineraries: PricedItinerary[] = AIRLINES.map((a, i) => {
      const fsc = `DEMO-FSC-${searchId}-${i}`;
      const total = a.base * pax * Math.max(1, legs.length);
      const it: PricedItinerary = {
        FareSourceCode: fsc,
        ValidatingAirlineCode: a.code,
        DirectionInd: r.TravelPreference?.AirTripType ?? AirTripType.OneWay,
        RefundMethod: i === 2 ? RefundMethod.NonRefundable : RefundMethod.Online,
        IsPassportMandatory: true,
        AirItineraryPricingInfo: {
          FareType: FareType.Publish,
          ItinTotalFare: { BaseFare: total * 0.82, TotalTax: total * 0.18, TotalFare: total, Currency: "USD" },
        },
        OriginDestinationOptions: legs.map(leg => ({
          JourneyDurationPerMinute: 115 + i * 10,
          FlightSegments: [{
            DepartureAirportLocationCode: leg.OriginLocationCode,
            ArrivalAirportLocationCode: leg.DestinationLocationCode,
            DepartureDateTime: iso(leg.DepartureDateTime, a.dep),
            ArrivalDateTime: iso(leg.DepartureDateTime, a.arr),
            MarketingAirlineCode: a.code,
            FlightNumber: a.flight,
            StopQuantity: i === 1 ? 1 : 0,
            CabinClassCode: r.TravelPreference?.CabinType ?? CabinType.Y,
            Baggage: i === 2 ? "20KG" : "30KG",
            SeatsRemaining: 4 + i,
          }],
        })),
      };
      this.fares.set(fsc, it);
      if (i === 1) this.repriced.add(fsc);
      return it;
    });
    return this.ok<FlightResponse<"AirLowFareSearch">>({ Success: true, SearchId: searchId, Error: null, PricedItineraries: itineraries });
  }

  protected doAirRevalidate(r: FlightRequest<"AirRevalidate">) {
    const fare = this.fares.get(r.FareSourceCode);
    if (!fare) return this.ok<FlightResponse<"AirRevalidate">>({ Success: false, Error: { Id: "Err0102008", Message: "Fare not found (demo)" } });
    if (this.repriced.has(r.FareSourceCode)) {
      const t = fare.AirItineraryPricingInfo?.ItinTotalFare;
      if (t?.TotalFare) t.TotalFare = Math.round(t.TotalFare * 1.08 * 100) / 100;
      this.repriced.delete(r.FareSourceCode);
    }
    return this.ok<FlightResponse<"AirRevalidate">>({ Success: true, SearchId: this.searchSeq, Error: null, PricedItinerary: fare });
  }

  protected doAirRules(_r: FlightRequest<"AirRules">) {
    return this.ok<FlightResponse<"AirRules">>({
      Success: true, Error: null, FareType: FareType.Publish,
      FareRules: [{ Airline: "DEMO", CityPair: "BGW-MHD", RuleDetails: [{ Category: "PENALTIES", Rules: "Demo rule: changes permitted with fee; refund subject to airline policy." }] }],
    });
  }

  protected doAirBaggages(_r: FlightRequest<"AirBaggages">) {
    return this.ok<FlightResponse<"AirBaggages">>({ Success: true, Error: null, BaggageInfoes: [{ Arrival: "MHD", Departure: "BGW", Baggage: "30KG", FlightNo: "DEMO" }] });
  }

  protected doAirBook(r: FlightRequest<"AirBook">) {
    const fare = this.fares.get(r.FareSourceCode);
    if (!fare) return this.ok<FlightResponse<"AirBook">>({ Success: false, Error: { Id: "Err0103001", Message: "Fare expired (demo)" }, PriceChange: false });
    const id = `DEMO-PO${Date.now().toString().slice(-6)}`;
    const limit = new Date(Date.now() + 3 * 3600_000).toISOString();
    this.bookings.set(id, {
      UniqueId: id, ClientUniqueId: r.ClientUniqueId ?? null, FareSourceCode: r.FareSourceCode,
      Status: AirQueueStatus.Booked, Category: AirQueueCategory.Booked, TktTimeLimit: limit, Notes: [],
      Total: fare.AirItineraryPricingInfo?.ItinTotalFare?.TotalFare ?? 0, Currency: fare.AirItineraryPricingInfo?.ItinTotalFare?.Currency ?? "USD",
    });
    return this.ok<FlightResponse<"AirBook">>({
      Success: true, SearchId: this.searchSeq, UniqueId: id, TktTimeLimit: limit, TktTimeLimitTimeZone: "UTC",
      Category: AirQueueCategory.Booked, Status: AirQueueStatus.Booked, PriceChange: false, Error: null, WarningMessage: ["Demonstration reservation — not sent to any airline."],
    });
  }

  protected doAirOrderTicket(r: FlightRequest<"AirOrderTicket">) {
    const b = this.bookings.get(r.UniqueId);
    if (!b || b.Status !== AirQueueStatus.Booked) return this.ok<FlightResponse<"AirOrderTicket">>({ Success: false, Error: { Id: "Err0104001", Message: "Booking not in Booked status (demo)" } });
    b.Status = AirQueueStatus.TicketinProcess;
    b.Category = AirQueueCategory.TicketinProcess;
    return this.ok<FlightResponse<"AirOrderTicket">>({ Success: true, Error: null, Category: b.Category, Status: b.Status });
  }

  protected doAirBookingData(r: FlightRequest<"AirBookingData">) {
    const b = r.UniqueId ? this.bookings.get(r.UniqueId) : undefined;
    if (!b) return this.ok<FlightResponse<"AirBookingData">>({ Success: false, Error: { Id: "Err0105001", Message: "Booking not found (demo)" } });
    // Simulate supplier completing issuance on the next status poll.
    if (b.Status === AirQueueStatus.TicketinProcess) { b.Status = AirQueueStatus.Ticketed; b.Category = AirQueueCategory.Ticketed; }
    return this.ok<FlightResponse<"AirBookingData">>({
      Success: true, Error: null, UniqueId: b.UniqueId, ClientUniqueId: b.ClientUniqueId,
      Status: b.Status, Category: b.Category, TktTimeLimit: b.TktTimeLimit, TktTimeLimitTimeZone: "UTC",
    });
  }

  protected doAirCancel(r: FlightRequest<"AirCancel">) {
    const b = this.bookings.get(r.UniqueId);
    if (!b || b.Status !== AirQueueStatus.Booked) return this.ok<FlightResponse<"AirCancel">>({ Success: false, Error: { Id: "Err0106001", Message: "Only Booked (unticketed) PNRs can be cancelled (demo)" } });
    b.Status = AirQueueStatus.Cancelled; b.Category = AirQueueCategory.Cancelled;
    return this.ok<FlightResponse<"AirCancel">>({ Success: true, Error: null });
  }

  protected doAirRefundDisplay(r: FlightRequest<"AirRefundDisplay">) {
    const b = this.bookings.get(r.UniqueId);
    const eligible = b?.Status === AirQueueStatus.Ticketed;
    return this.ok<FlightResponse<"AirRefundDisplay">>(eligible
      ? { Success: true, Error: null, RefundType: RefundType.Pnr, EticketNumbers: [] }
      : { Success: false, Error: { Id: "Err0107001", Message: "Refund available only for ticketed bookings (demo)" } });
  }

  protected doAirRefund(_r: FlightRequest<"AirRefund">) {
    return this.ok<FlightResponse<"AirRefund">>({ Success: false, Error: { Id: "DEMO", Message: "Refunds are never executed in demo mode." } });
  }

  protected doAirAddBookingNotes(r: FlightRequest<"AirAddBookingNotes">) {
    const b = this.bookings.get(r.UniqueId);
    if (b) b.Notes.push(...r.Notes);
    return this.ok<FlightResponse<"AirAddBookingNotes">>({ Success: Boolean(b), Error: b ? null : { Id: "Err0108001", Message: "Booking not found (demo)" } });
  }
}
