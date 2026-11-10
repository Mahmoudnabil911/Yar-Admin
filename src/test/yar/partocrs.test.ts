import { describe, expect, it, vi } from "vitest";
import { MockPartoFlightAdapter, AirQueueStatus, isTicketed, AirTripType, CabinType, MaxStopsQuantity, PricingSourceType, RequestOption, SearchLocationType, priceChanged } from "@/yar/integrations/partocrs";

const search = (a: MockPartoFlightAdapter) => a.call("AirLowFareSearch", {
  PricingSourceType: PricingSourceType.All, RequestOption: RequestOption.Fifty, AdultCount: 1, ChildCount: 0, InfantCount: 0, IsGenuine: false,
  TravelPreference: { CabinType: CabinType.Y, MaxStopsQuantity: MaxStopsQuantity.All, AirTripType: AirTripType.OneWay },
  OriginDestinationInformations: [{ OriginLocationCode: "BGW", DestinationLocationCode: "MHD", DepartureDateTime: "2026-12-01T00:00:00", OriginType: SearchLocationType.Airport, DestinationType: SearchLocationType.Airport }],
});

describe("PartoCRS mock adapter", () => {
  it("never makes network requests and labels results as demo", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    const res = await search(new MockPartoFlightAdapter());
    expect(res.isDemo).toBe(true);
    expect(res.data.PricedItineraries?.length).toBe(3);
    expect(f).not.toHaveBeenCalled();
  });

  it("a reservation is not ticketed until issuance is confirmed", async () => {
    const a = new MockPartoFlightAdapter();
    const fsc = (await search(a)).data.PricedItineraries![0]!.FareSourceCode!;
    const booked = await a.call("AirBook", { FareSourceCode: fsc, TravelerInfo: { AirTravelers: [] } });
    expect(booked.data.Status).toBe(AirQueueStatus.Booked);
    expect(isTicketed(booked.data.Status)).toBe(false);
    const ordered = await a.call("AirOrderTicket", { UniqueId: booked.data.UniqueId! });
    expect(isTicketed(ordered.data.Status)).toBe(false);
    const data = await a.call("AirBookingData", { UniqueId: booked.data.UniqueId! });
    expect(isTicketed(data.data.Status)).toBe(true);
  });

  it("flags price changes on revalidation", async () => {
    const a = new MockPartoFlightAdapter();
    const it1 = (await search(a)).data.PricedItineraries![1]!;
    const before = it1.AirItineraryPricingInfo!.ItinTotalFare!.TotalFare!;
    const r = await a.call("AirRevalidate", { FareSourceCode: it1.FareSourceCode! });
    expect(priceChanged(before, r.data.PricedItinerary!.AirItineraryPricingInfo!.ItinTotalFare!.TotalFare)).toBe(true);
  });
});
