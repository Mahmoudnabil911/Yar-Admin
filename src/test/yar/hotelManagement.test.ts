import { describe, it, expect } from 'vitest';
import { minimumRoomPrice, startingRates, includesBreakfast, quoteStay, availabilityFor, seasonError, occupancyError, migrateHotel, nightsBetween, offerSnapshot, publishChecklist, matchHotel, emptyHotelFilters, supplierTotal } from '@/yar/services/hotelPricing';
import { sampleResort } from '@/yar/services/models/hotel-schema';
// @ts-expect-error -- plain JS module
import { roleCan } from '@/yar/auth/access.js';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const deluxe = () => clone(sampleResort['rooms'][1]) as any;
const plan = (room: any, code: string) => room.ratePlans.find((p: any) => p.mealPlan === code);

describe('hotel rate plans', () => {
  it('keeps an independent price for every meal plan of the same room', () => {
    const room = deluxe();
    expect(room.ratePlans.map((p: any) => [p.mealPlan, p.nightlyPrice])).toEqual([['RO', 150000], ['BB', 175000], ['HB', 205000], ['FB', 230000], ['AI', 280000]]);
  });

  it('Room Only never shows breakfast; Half Board and All Inclusive are different plans', () => {
    expect(includesBreakfast('RO')).toBe(false);
    expect(includesBreakfast('BB')).toBe(true);
    const room = deluxe();
    expect(plan(room, 'HB').nightlyPrice).not.toBe(plan(room, 'AI').nightlyPrice);
  });

  it('starting price is the lowest active plan, ignoring inactive plans and other currencies', () => {
    const room = deluxe();
    room.ratePlans[0].status = 'inactive';
    room.ratePlans.push({ id: 'usd', mealPlan: 'RO', currency: 'USD', priceBasis: 'per_room_night', nightlyPrice: 90, status: 'active' });
    expect(minimumRoomPrice([room])).toBe(175000);
    expect(startingRates({ rooms: [room] })).toEqual({ IQD: 175000, USD: 90 });
  });

  it('different room variants of one category keep their own prices', () => {
    const sea = deluxe();
    const garden = { ...deluxe(), id: 'garden', viewType: 'garden', ratePlans: [{ id: 'g-ro', mealPlan: 'RO', currency: 'IQD', priceBasis: 'per_room_night', nightlyPrice: 130000, status: 'active' }] };
    expect(minimumRoomPrice([sea])).toBe(150000);
    expect(minimumRoomPrice([garden])).toBe(130000);
  });
});

describe('stay pricing', () => {
  it('Half Board 205,000 × 4 nights × 2 rooms = 1,640,000 IQD', () => {
    const room = deluxe();
    const q = quoteStay({ room, plan: plan(room, 'HB'), checkIn: '2026-12-01', checkOut: '2026-12-05', rooms: 2, adults: 4 });
    expect(q.nights).toBe(4);
    expect(q.total).toBe(1640000);
    expect(q.currency).toBe('IQD');
  });

  it('check-in is inclusive and check-out exclusive', () => {
    expect(nightsBetween('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01']);
  });

  it('seasonal price applies only to its configured dates', () => {
    const room = deluxe();
    room.seasons = [{ name: 'High', ratePlanId: 'yar-dlx-ro', startDate: '2026-12-02', endDate: '2026-12-02', nightlyPrice: 200000 }];
    const q = quoteStay({ room, plan: plan(room, 'RO'), checkIn: '2026-12-01', checkOut: '2026-12-04', rooms: 1, adults: 2 });
    expect(q.nightly.map(n => n.price)).toEqual([150000, 200000, 150000]);
    expect(q.total).toBe(500000);
  });

  it('rejects overlapping seasons of the same plan but allows other meal plans on the same dates', () => {
    const room = deluxe();
    room.seasons = [
      { ratePlanId: 'yar-dlx-ro', startDate: '2026-12-01', endDate: '2026-12-10', nightlyPrice: 1000 },
      { ratePlanId: 'yar-dlx-bb', startDate: '2026-12-01', endDate: '2026-12-10', nightlyPrice: 1000 },
    ];
    expect(seasonError(room)).toBe('');
    room.seasons.push({ ratePlanId: 'yar-dlx-ro', startDate: '2026-12-10', endDate: '2026-12-12', nightlyPrice: 1000 });
    expect(seasonError(room)).not.toBe('');
  });

  it('does not treat children as free when no child charge is configured', () => {
    const room = deluxe();
    const q = quoteStay({ room, plan: plan(room, 'BB'), checkIn: '2026-12-01', checkOut: '2026-12-02', rooms: 1, adults: 2, children: 1 });
    expect(q.notes.some(n => n.includes('الأطفال'))).toBe(true);
  });

  it('blocks guests beyond room capacity', () => {
    const room = deluxe();
    const q = quoteStay({ room, plan: plan(room, 'RO'), checkIn: '2026-12-01', checkOut: '2026-12-02', rooms: 1, adults: 3 });
    expect(q.errors.length).toBeGreaterThan(0);
  });

  it('derives supplier cost for the same stay only when configured', () => {
    expect(supplierTotal({ priceBasis: 'per_room_night', supplierCost: 100 }, { nights: 3 }, 2, 4)).toBe(600);
    expect(supplierTotal({ priceBasis: 'per_room_night' }, { nights: 3 }, 2, 4)).toBeNull();
  });
});

describe('availability and inventory', () => {
  it('unknown or empty availability is never reported as available', () => {
    expect(availabilityFor({ availability: [] }, '2026-12-01', '2026-12-03').status).toBe('unknown');
    const room = { availability: [{ startDate: '2026-12-01', endDate: '2026-12-01', availableRooms: 3 }] };
    expect(availabilityFor(room, '2026-12-01', '2026-12-03').status).toBe('unknown');
  });

  it('inventory is shared by all rate plans of the room (one pool)', () => {
    const room = deluxe();
    room.availability = [{ startDate: '2026-12-01', endDate: '2026-12-31', availableRooms: 2, totalRooms: 6 }];
    expect(availabilityFor(room, '2026-12-01', '2026-12-03', 2).status).toBe('available');
    expect(availabilityFor(room, '2026-12-01', '2026-12-03', 3).status).toBe('insufficient');
  });

  it('rejects negative availability and occupancy beyond maximum', () => {
    expect(occupancyError({ availability: [{ availableRooms: -1 }] })).not.toBe('');
    expect(occupancyError({ standardAdults: 3, maxAdults: 2, capacity: 3 })).not.toBe('');
  });
});

describe('legacy migration and snapshots', () => {
  it('maps breakfast true → BB and false → RO with the historical price, preserving the room', () => {
    const hotel: any = migrateHotel({ id: 'h1', rooms: [{ name: 'A', capacity: 2, nightlyPrice: 145000, breakfast: true }, { name: 'B', capacity: 2, nightlyPrice: 75000, breakfast: false }] });
    expect(hotel.rooms[0].ratePlans[0]).toMatchObject({ mealPlan: 'BB', nightlyPrice: 145000, legacy: true });
    expect(hotel.rooms[1].ratePlans[0]).toMatchObject({ mealPlan: 'RO', nightlyPrice: 75000 });
    expect(hotel.rooms[0]).toMatchObject({ id: 'h1-room-1', name: 'A', capacity: 2, nightlyPrice: 145000, breakfast: true });
    expect(hotel.rooms[0].viewType).toBeUndefined();
    expect(migrateHotel(clone(hotel)).rooms[0].ratePlans).toHaveLength(1);
  });

  it('booking snapshot does not change when the hotel price is edited later', () => {
    const room = deluxe();
    const p = plan(room, 'HB');
    const quote = quoteStay({ room, plan: p, checkIn: '2026-12-01', checkOut: '2026-12-03', rooms: 1, adults: 2 });
    const snap = offerSnapshot({ hotel: sampleResort, room, plan: p, quote, request: {} });
    p.nightlyPrice = 999999;
    expect(snap['quote'].total).toBe(410000);
    expect(snap['room'].viewType).toBe('sea');
  });

  it('a complete sample hotel can be published; an empty one cannot', () => {
    expect(publishChecklist(sampleResort)).toEqual([]);
    expect(publishChecklist({ rooms: [] }).length).toBeGreaterThan(0);
  });
});

describe('hotel list filters and permissions', () => {
  it('filters by facility, meal plan and view', () => {
    expect(matchHotel(sampleResort, { ...emptyHotelFilters, facility: 'spa', mealPlan: 'AI', viewType: 'sea' })).toBe(true);
    expect(matchHotel(sampleResort, { ...emptyHotelFilters, mealPlan: 'UAI' })).toBe(false);
  });

  it('booking employee cannot edit hotel master data', () => {
    expect(roleCan('booking_employee', 'catalog.manage')).toBe(false);
    expect(roleCan('admin', 'catalog.manage')).toBe(true);
  });
});
