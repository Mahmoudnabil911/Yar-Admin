const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dist = path.join(__dirname, '..', 'dist');
const sandbox = { window: {}, Date, Intl, URL };
for (const file of ['catalog-hotels.js', 'catalog-packages.js', 'catalog-services.js', 'catalog-tours.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(dist, file), 'utf8'), sandbox, { filename: file });
}
const types = sandbox.window.YAR_CATALOG_TYPES;
const clone = value => JSON.parse(JSON.stringify(value));
const catalogs = Object.fromEntries(Object.entries(types).map(([key, type]) => [key, clone(type.seed)]));
const field = (type, key) => type.fields.find(item => item.key === key);
const hotel = changes => ({ ...clone(types.hotels.seed[0]), ...changes });
const period = changes => ({ startDate: '2028-02-28', endDate: '2028-02-29', nightlyPrice: 160000, availableRooms: 2, ...changes });
function hotelWithPeriods(periods) {
  const record = hotel();
  record.rooms[0].availability = periods;
  return record;
}

const expoFixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'expo-parity.json'), 'utf8'));
function expoArray(name) { assert.ok(Array.isArray(expoFixture[name]), 'Approved Expo fixture exists: '+name); return clone(expoFixture[name]); }

test('all catalog seeds validate with their actual cross-catalog provider references', () => {
  for (const [key, type] of Object.entries(types)) {
    for (const record of type.seed) assert.equal(type.validate?.(clone(record), catalogs) || '', '', `${key}/${record.id}`);
  }
  assert.equal(types.tours.seed.length, 4);
  assert.equal(types.providers.seed.find(record => record.id === 'provider-tours').serviceType, 'tour');
});

test('hotel policy fields are specific and availability is absent until explicitly entered', () => {
  for (const key of ['checkIn', 'checkOut', 'cancellationPolicy']) assert.ok(field(types.hotels, key));
  for (const record of types.hotels.seed) {
    assert.equal(record.checkIn, '14:00');
    assert.equal(record.checkOut, '12:00');
    assert.match(record.cancellationPolicy, /غير معتمدة/);
    for (const room of record.rooms) assert.deepEqual(clone(room.availability), []);
  }
  const availability = field(types.hotels, 'rooms').fields.find(item => item.key === 'availability');
  assert.equal(availability.type, 'repeat');
  assert.deepEqual(clone(availability.fields.map(item => item.key)), ['startDate', 'endDate', 'nightlyPrice', 'availableRooms']);
  assert.equal(availability.fields.find(item => item.key === 'startDate').type, 'date');
  for (const time of ['24:00', '9:30', '12:60', 'noon']) assert.notEqual(types.hotels.validate(hotel({ checkIn: time })), '');
  assert.notEqual(types.hotels.validate(hotel({ cancellationPolicy: '' })), '');
  assert.equal(types.hotels.validate(hotel({ status: 'draft', checkIn: '', checkOut: '', cancellationPolicy: '' })), '');
});

test('room periods use strict calendar dates and inclusive non-overlapping ranges per room', () => {
  assert.equal(types.hotels.validate(hotelWithPeriods([period()])), '');
  for (const dates of [
    { startDate: '2026-02-29', endDate: '2026-03-01' },
    { startDate: '2028-02-30', endDate: '2028-03-01' },
    { startDate: '2028-03-01', endDate: '2028-02-29' },
    { startDate: '2028-2-28' }, { startDate: '0000-01-01' }, { startDate: '' },
  ]) assert.notEqual(types.hotels.validate(hotelWithPeriods([period(dates)])), '', JSON.stringify(dates));
  assert.notEqual(types.hotels.validate(hotelWithPeriods([period(), period({ startDate: '2028-02-29', endDate: '2028-03-02' })])), '');
  assert.notEqual(types.hotels.validate(hotelWithPeriods([period({ endDate: '2028-03-05' }), period({ startDate: '2028-03-01', endDate: '2028-03-02' })])), '');
  const nonOverlapping = hotelWithPeriods([period({ startDate: '2028-03-01', endDate: '2028-03-02' }), period()]);
  const before = clone(nonOverlapping);
  assert.equal(types.hotels.validate(nonOverlapping), '');
  assert.deepEqual(nonOverlapping, before, 'validation does not reorder stored periods');
  nonOverlapping.rooms[1].availability = [period()];
  assert.equal(types.hotels.validate(nonOverlapping), '', 'different room types may share a period');
});

test('explicit zero availability is valid, but missing/fractional/negative stock and invalid prices are rejected', () => {
  assert.equal(types.hotels.validate(hotelWithPeriods([period({ availableRooms: 0 })])), '');
  for (const availableRooms of [null, '', -1, 0.5, 1001, Infinity]) {
    assert.notEqual(types.hotels.validate(hotelWithPeriods([period({ availableRooms })])), '', String(availableRooms));
  }
  for (const nightlyPrice of [null, 0, -1, 999, 10000001, NaN, Infinity]) {
    assert.notEqual(types.hotels.validate(hotelWithPeriods([period({ nightlyPrice })])), '', String(nightlyPrice));
  }
});

test('package options retain Expo IDs, prices and the correct independent two-image galleries', () => {
  const optionsField = field(types.packages, 'hotelOptions');
  const idField = optionsField.fields.find(item => item.key === 'optionId');
  assert.equal(idField.generated, true);
  assert.equal(idField.readOnly, true);
  assert.equal(idField.type, 'text');
  assert.equal(field(types.packages, 'optionId'), undefined, 'option IDs belong to each option, not to the package');
  assert.ok(optionsField.fields.some(item => item.key === 'photos' && item.type === 'photos'));
  assert.ok(optionsField.fields.some(item => item.key === 'description' && item.type === 'textarea'));
  const photos = expoArray('hotelPhotos');
  const offers = expoArray('packageHotels');
  const options = types.packages.seed.find(record => record.id === 'package-mashhad').hotelOptions;
  options.forEach((option, index) => {
    assert.equal(option.optionId, offers[index].id);
    assert.equal(option.price5USD, offers[index].five);
    assert.equal(option.price7USD, offers[index].seven);
    assert.deepEqual(clone(option.photos), [photos[index], photos[(index + 1) % 3]]);
    assert.ok(option.description);
  });
  const duplicate = clone(types.packages.seed[0]);
  duplicate.hotelOptions[1].optionId = duplicate.hotelOptions[0].optionId;
  assert.notEqual(types.packages.validate(duplicate), '');
  duplicate.hotelOptions[1].optionId = '';
  assert.notEqual(types.packages.validate(duplicate), '');
});

test('all vehicle capacities, photos and twelve city fares match the current Expo demo', () => {
  const cars = expoArray('cars');
  const fees = { 'مشهد': 0, 'طهران': 15, 'شيراز': 5, 'أصفهان': 10 };
  assert.equal(types.cars.seed.reduce((sum, car) => sum + car.cityPrices.length, 0), 12);
  types.cars.seed.forEach((car, index) => {
    assert.equal(car.seatCount, cars[index].seats);
    assert.equal(car.bags, cars[index].bags);
    assert.deepEqual(clone(car.photos), clone(cars[index].photos));
    assert.equal(car.serviceProvider, 'provider-transfer');
    for (const [city, fee] of Object.entries(fees)) {
      const price = car.cityPrices.find(item => item.city === city);
      assert.ok(price, `${car.id}/${city}`);
      assert.equal(price.oneWayUSD, cars[index].base + fee);
      assert.equal(price.roundTripUSD, (cars[index].base + fee) * 2);
    }
  });
});

test('the four tour seeds match Expo itinerary, duration, group capacity, prices and approved local images', () => {
  const tours = expoArray('tours');
  types.tours.seed.forEach((tour, index) => {
    assert.equal(tour.name, tours[index].name);
    assert.equal(tour.city, tours[index].city);
    assert.equal(tour.duration, tours[index].hours);
    assert.equal(tour.itinerary, tours[index].places);
    assert.equal(tour.priceUSD, tours[index].price);
    assert.equal(tour.capacity, 3);
    assert.deepEqual(clone(tour.photos), [`assets/content/${tours[index].photo}.jpg`]);
    assert.ok(fs.existsSync(path.join(dist, tour.photos[0])));
    assert.match(tour.priceBasis, /للمجموعة/);
    assert.match(tour.exclusions, /الوجبات/);
  });
});

test('tour publication validates price, duration, capacity, itinerary, galleries and scope', () => {
  const original = clone(types.tours.seed[0]);
  for (const change of [
    { priceUSD: 0 }, { priceUSD: Infinity }, { capacity: 0 }, { capacity: 3.5 },
    { duration: 0 }, { duration: 0.75 }, { duration: 73 }, { itinerary: '' },
    { priceBasis: '' }, { city: 'غير معروفة' }, { inclusions: '' }, { exclusions: '' }, { photos: [] },
  ]) assert.notEqual(types.tours.validate({ ...original, ...change }, catalogs), '', JSON.stringify(change));
  assert.equal(types.tours.validate({ ...original, serviceProvider: '' }, {}), '', 'a provider is optional even for publication');
  assert.notEqual(types.tours.validate({ ...original, serviceProvider: 'provider-transfer' }, catalogs), '');
  const unpublished = clone(catalogs);
  unpublished.providers.find(item => item.id === 'provider-tours').status = 'draft';
  assert.notEqual(types.tours.validate(original, unpublished), '');
  assert.equal(types.tours.validate({ ...original, status: 'draft' }, unpublished), '');
  const options = field(types.tours, 'serviceProvider').options(catalogs);
  assert.deepEqual(clone(options.map(item => item.value)), ['provider-tours']);
  const providerTypes = field(types.providers, 'serviceType').options.map(item => item.value);
  assert.ok(providerTypes.includes('tour'));
});

test('provider operations fields use shared defaults and fallback choices stay scoped to published flights', () => {
  assert.equal(field(types.providers, 'operatingEnabled').type, 'checkbox');
  assert.deepEqual(clone(field(types.providers, 'environment').options.map(item => item.value)), ['test', 'production']);
  for (const provider of types.providers.seed) {
    assert.equal(provider.operatingEnabled, true);
    assert.equal(provider.environment, 'test');
    assert.equal(provider.fallbackProviderId, '');
  }
  const records = clone(catalogs);
  records.providers.push({ id: 'draft-flight', serviceType: 'flight', status: 'draft' });
  const options = field(types.providers, 'fallbackProviderId').options(records);
  assert.deepEqual(clone(options.map(item => item.value)), ['provider-afaq', 'provider-madar']);
  const provider = clone(types.providers.seed[0]);
  assert.notEqual(types.providers.validate({ ...provider, environment: 'live' }), '');
  assert.notEqual(types.providers.validate({ ...provider, operatingEnabled: 'yes' }), '');
});
