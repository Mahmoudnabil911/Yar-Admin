(() => {
  'use strict';

  const serviceLabels = { flight: 'الطيران', hotel: 'الفنادق', package: 'الباقات', transfer: 'النقل', tour: 'الجولات' };
  const array = value => Array.isArray(value) ? value : [];
  const text = value => typeof value === 'string' ? value.trim().slice(0, 180) : '';
  const currencies = new Set(['IQD', 'USD']);
  const rate = (part, total) => total ? part / total * 100 : null;
  const round = (value, currency) => Math.round((value + Number.EPSILON) * (currency === 'IQD' ? 1 : 100)) / (currency === 'IQD' ? 1 : 100);
  const distinct = (rows, key) => new Set(rows.map(key)).size;
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith('0000') && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
  function shift(date, days) { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
  const before = (left, right) => left.date < right.date || left.date === right.date && left.sequence < right.sequence;
  const identity = session => session.userId ? 'user:' + session.userId : 'browser:' + (session.visitorId || session.id);

  // An independent, closed set of fictitious journeys. No telemetry is collected.
  function createDemo(baseData, anchorDate) {
    const anchor = anchorDate || array(baseData?.sessions).map(s => s.date).filter(validDate).sort().at(-1);
    if (!validDate(anchor)) throw new RangeError('حدّد تاريخًا صحيحًا لبيانات المعاينة.');
    const campaigns = [{ id: 'campaign-mashhad', label: 'حملة مشهد · مثال' }, { id: 'campaign-family', label: 'رحلات العائلة · مثال' }, { id: 'campaign-north', label: 'اكتشف الشمال · مثال' }];
    const offers = [{ id: 'offer-20', label: 'عرض السفر · خصم 20%', discountPercent: 20 }, { id: 'offer-10', label: 'عرض العائلة · خصم 10%', discountPercent: 10 }];
    const destinations = [ ['مشهد', 'MHD'], ['طهران', 'IKA'], ['مشهد', 'MHD'], ['شيراز', 'SYZ'], ['شمال إيران', 'RAS'], ['مشهد', 'MHD'], ['أصفهان', 'IFN'] ];
    const origins = [['بغداد', 'BGW'], ['النجف', 'NJF'], ['البصرة', 'BSR'], ['أربيل', 'EBL']];
    const sessions = [], events = [];
    const base = array(baseData?.sessions);
    for (let i = 0; i < base.length; i++) {
      const source = base[i];
      if (!validDate(source.date) || !['ios', 'android'].includes(source.platform)) continue;
      const service = Object.keys(serviceLabels)[i % 5];
      const session = { id: 'behavior-' + (text(source.id) || i), date: source.date, platform: source.platform, service, visitorId: text(source.visitorId) || 'device-' + i, userId: text(source.userId) || null, ended: true };
      sessions.push(session);
      let sequence = 0;
      const emit = (type, data = {}) => { const event = { id: session.id + '-event-' + (++sequence), sessionId: session.id, date: session.date, sequence, type, ...data }; events.push(event); return event; };
      const currency = ['flight', 'hotel'].includes(service) ? 'IQD' : 'USD';
      if (i % 3 !== 0 || i % 10 === 0) {
        const campaignId = campaigns[i % 3].id;
        emit('campaign_impression', { campaignId, currency });
        if (i % 3 === 1 || i % 7 === 0 || i % 10 === 0) emit('campaign_click', { campaignId, currency, cost: currency === 'USD' ? 0.35 : 450 });
        if (i % 10 === 0) { emit('campaign_impression', { campaignId: campaigns[1].id, currency }); emit('campaign_click', { campaignId: campaigns[1].id, currency, cost: currency === 'USD' ? 0.4 : 500 }); }
      }
      let clickedOffer = null;
      if (i % 2 === 0) { const offer = offers[Math.floor(i / 2) % 2]; emit('offer_impression', { offerId: offer.id }); if (i % 3 !== 0) { emit('offer_click', { offerId: offer.id }); clickedOffer = offer; } }
      const outcome = i % 12;
      if (outcome === 0) continue;
      const destination = destinations[i % destinations.length], origin = origins[i % origins.length];
      const searchData = { origin: origin[0], originCode: origin[1], destination: destination[0], destinationCode: destination[1], travelDate: shift(anchor, 7 + i % 28), currency, resultCount: i % 11 === 0 ? 0 : 3 + i % 18 };
      if (service === 'hotel') searchData.stayNights = [3, 5, 7, 10][Math.floor(i / 5) % 4];
      if (service === 'package') searchData.packageDays = [5, 7, 9][Math.floor(i / 5) % 3];
      let search = emit('search', searchData);
      if (i % 4 === 0) search = emit('search', { ...searchData, resultCount: 4 + i % 12 });
      if (outcome < 3 || !search.resultCount) continue;
      const item = service === 'hotel' ? { itemId: 'hotel-' + destination[1] + '-' + i % 2, itemLabel: (i % 2 ? 'فندق أفق' : 'فندق حدائق يار') + ' · ' + destination[0] } : service === 'package' ? { itemId: 'package-' + destination[1], itemLabel: 'باقة ' + destination[0] } : { itemId: service + '-' + destination[1], itemLabel: serviceLabels[service] + ' · ' + destination[0] };
      let view = emit('view', { searchId: search.id, ...item });
      if (i % 5 === 0) view = emit('view', { searchId: search.id, ...item });
      if (outcome < 6) continue;
      const checkout = emit('checkout', { viewId: view.id });
      if (outcome < 8) continue;
      const request = emit('request', { checkoutId: checkout.id, requestId: 'request-behavior-' + i });
      const baseAmount = currency === 'IQD' ? (service === 'hotel' ? 145000 * search.stayNights : 245000 + i % 4 * 30000) : (service === 'package' ? 275 + i % 3 * 35 : service === 'transfer' ? 30 + i % 3 * 15 : 85 + i % 3 * 10);
      const amount = round(baseAmount * (1 - (clickedOffer?.discountPercent || 0) / 100), currency);
      const status = outcome === 8 ? 'pending' : outcome === 11 ? 'cancelled' : 'confirmed';
      emit('booking', { requestId: request.requestId, bookingId: 'booking-behavior-' + i, status, currency, amount, offerId: clickedOffer?.id || null, discountPercent: clickedOffer?.discountPercent || 0 });
    }
    return { sessions, events, campaigns, offers };
  }

  function normalize(data) {
    const sessions = new Map(), events = new Map();
    for (const row of array(data?.sessions)) {
      const id = text(row?.id);
      if (!id || sessions.has(id) || !validDate(row.date) || !['ios', 'android'].includes(row.platform) || !Object.hasOwn(serviceLabels, row.service)) continue;
      sessions.set(id, { id, date: row.date, platform: row.platform, service: row.service, userId: text(row.userId) || null, visitorId: text(row.visitorId), ended: row.ended === true });
    }
    const uniqueMetadata = (rows, kind) => {
      const map = new Map();
      for (const row of array(rows)) { const id = text(row?.id), label = text(row?.label); if (id && label && !map.has(id) && (kind !== 'offer' || typeof row.discountPercent === 'number' && Number.isFinite(row.discountPercent) && row.discountPercent > 0 && row.discountPercent <= 100)) map.set(id, { id, label, ...(kind === 'offer' ? { discountPercent: row.discountPercent } : {}) }); }
      return map;
    };
    for (const row of array(data?.events)) {
      const id = text(row?.id), session = sessions.get(text(row?.sessionId));
      if (!id || events.has(id) || !session || !validDate(row.date) || row.date < session.date || !Number.isInteger(row.sequence) || row.sequence < 0) continue;
      events.set(id, { ...row, id, sessionId: session.id, session, service: session.service, who: identity(session) });
    }
    return { sessions: [...sessions.values()], events: [...events.values()].sort((a, b) => a.date.localeCompare(b.date) || a.sequence - b.sequence || a.id.localeCompare(b.id)), campaigns: uniqueMetadata(data?.campaigns), offers: uniqueMetadata(data?.offers, 'offer') };
  }

  function report(dataset, filters = {}) {
    const normalized = normalize(dataset), platform = filters.platform || 'all', service = filters.service || 'all';
    const endDate = filters.endDate || normalized.sessions.map(s => s.date).sort().at(-1) || '2026-11-07';
    const startDate = filters.startDate || shift(endDate, -29);
    if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) throw new RangeError('اختر فترة تحليل صحيحة.');
    if (!['all', 'ios', 'android'].includes(platform)) throw new RangeError('اختر منصة صحيحة.');
    if (service !== 'all' && !Object.hasOwn(serviceLabels, service)) throw new RangeError('اختر خدمة صحيحة.');
    const sessions = normalized.sessions.filter(s => s.date >= startDate && s.date <= endDate && (platform === 'all' || s.platform === platform) && (service === 'all' || s.service === service));
    const sessionMap = new Map(sessions.map(s => [s.id, s]));
    const events = normalized.events.filter(e => sessionMap.has(e.sessionId) && e.date >= startDate && e.date <= endDate);
    const searches = [], views = [], checkouts = [], requests = [], bookingMap = new Map(), ads = [], promotions = [];
    const searchMap = new Map(), viewMap = new Map(), checkoutMap = new Map(), requestMap = new Map();
    const earlier = (map, key, event) => { const parent = map.get(text(key)); return parent && parent.sessionId === event.sessionId && before(parent, event) ? parent : null; };
    const latestClick = (rows, event, key) => rows.filter(e => e.type.endsWith('_click') && e.sessionId === event.sessionId && before(e, event) && (key !== 'currency' || e.currency === event.currency)).at(-1) || null;
    for (const event of events) {
      const e = { ...event };
      if (e.type === 'campaign_impression' || e.type === 'campaign_click') {
        if (!normalized.campaigns.has(text(e.campaignId)) || !currencies.has(e.currency)) continue;
        if (e.type === 'campaign_click' && (!ads.some(a => a.type === 'campaign_impression' && a.campaignId === e.campaignId && a.currency === e.currency && a.sessionId === e.sessionId && before(a, e)) || typeof e.cost !== 'number' || !Number.isFinite(e.cost) || e.cost < 0)) continue;
        ads.push(e); continue;
      }
      if (e.type === 'offer_impression' || e.type === 'offer_click') {
        if (!normalized.offers.has(text(e.offerId))) continue;
        if (e.type === 'offer_click' && !promotions.some(a => a.type === 'offer_impression' && a.offerId === e.offerId && a.sessionId === e.sessionId && before(a, e))) continue;
        promotions.push(e); continue;
      }
      if (e.type === 'search') {
        if (!text(e.destination) || !Number.isInteger(e.resultCount) || e.resultCount < 0 || !currencies.has(e.currency) || !validDate(e.travelDate) || e.travelDate < e.date) continue;
        if (e.service === 'flight' && (!text(e.origin) || text(e.origin) === text(e.destination))) continue;
        e.campaignId = latestClick(ads, e, 'currency')?.campaignId || null;
        e.offerId = latestClick(promotions, e)?.offerId || null;
        searches.push(e); searchMap.set(e.id, e); continue;
      }
      if (e.type === 'view') {
        const search = earlier(searchMap, e.searchId, e);
        if (!search || !search.resultCount || !text(e.itemId) || !text(e.itemLabel)) continue;
        e.search = search; views.push(e); viewMap.set(e.id, e); continue;
      }
      if (e.type === 'checkout') {
        const view = earlier(viewMap, e.viewId, e); if (!view) continue;
        e.view = view; e.search = view.search; checkouts.push(e); checkoutMap.set(e.id, e); continue;
      }
      if (e.type === 'request') {
        const checkout = earlier(checkoutMap, e.checkoutId, e); if (!checkout || !text(e.requestId) || requestMap.has(e.requestId)) continue;
        e.checkout = checkout; e.view = checkout.view; e.search = checkout.search; requests.push(e); requestMap.set(e.requestId, e); continue;
      }
      if (e.type === 'booking') {
        const request = earlier(requestMap, e.requestId, e);
        if (!request || !text(e.bookingId) || !['pending', 'confirmed', 'cancelled'].includes(e.status) || !currencies.has(e.currency) || e.currency !== request.search.currency || typeof e.amount !== 'number' || !Number.isFinite(e.amount) || e.amount < 0) continue;
        const previous = bookingMap.get(e.bookingId);
        if (previous && previous.requestId !== e.requestId) continue;
        e.request = request; e.view = request.view; e.search = request.search; bookingMap.set(e.bookingId, e);
      }
    }
    const confirmed = [...bookingMap.values()].filter(b => b.status === 'confirmed');
    const convertedSessions = (rows, bookings = confirmed) => distinct(bookings.filter(b => rows.some(s => s.id === b.search.id)), b => b.sessionId);
    const searchSummary = (rows, bookings = confirmed) => ({ searches: rows.length, users: distinct(rows, e => e.who), searchSessions: distinct(rows, e => e.sessionId), confirmed: bookings.filter(b => rows.some(s => s.id === b.search.id)).length, convertedSessions: convertedSessions(rows, bookings), conversion: rate(convertedSessions(rows, bookings), distinct(rows, e => e.sessionId)) });
    const groupSearches = (keyOf, labelOf) => {
      const groups = new Map();
      for (const e of searches) { const key = keyOf(e); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(e); }
      return [...groups].map(([key, rows]) => ({ key, label: labelOf(rows[0]), ...searchSummary(rows) })).sort((a, b) => b.searches - a.searches || a.label.localeCompare(b.label, 'ar'));
    };
    const destinations = groupSearches(e => text(e.destinationCode) || text(e.destination), e => text(e.destination));
    const routes = groupSearches(e => (text(e.originCode) || text(e.origin)) + ':' + (text(e.destinationCode) || text(e.destination)), e => e.origin ? `${text(e.origin)} ← ${text(e.destination)}` : text(e.destination));
    const items = [];
    for (const key of new Set(views.filter(v => ['hotel', 'package'].includes(v.service)).map(v => v.service + ':' + v.itemId))) {
      const matching = views.filter(v => v.service + ':' + v.itemId === key), first = matching[0];
      items.push({ key, label: text(first.itemLabel), service: first.service, views: matching.length, users: distinct(matching, v => v.who), requests: requests.filter(r => r.service === first.service && r.view.itemId === first.itemId).length, confirmed: confirmed.filter(b => b.service === first.service && b.view.itemId === first.itemId).length });
    }
    items.sort((a, b) => b.views - a.views || a.label.localeCompare(b.label, 'ar'));
    const zeroResults = groupSearches(e => `${e.service}:${e.origin}:${e.destination}:${e.travelDate}`, e => e.origin ? `${text(e.origin)} ← ${text(e.destination)}` : text(e.destination)).map(group => {
      const matching = searches.filter(e => `${e.service}:${e.origin}:${e.destination}:${e.travelDate}` === group.key && e.resultCount === 0);
      return matching.length ? { key: group.key, label: group.label, service: matching[0].service, travelDate: matching[0].travelDate, searches: matching.length, users: distinct(matching, e => e.who) } : null;
    }).filter(Boolean).sort((a, b) => b.searches - a.searches || a.travelDate.localeCompare(b.travelDate));
    const stages = [ ['search', 'بعد البحث وقبل التفاصيل', searches, views], ['details', 'بعد التفاصيل وقبل بدء الحجز', views, checkouts], ['checkout', 'بعد بدء الحجز وقبل إرسال الطلب', checkouts, requests] ];
    const abandonment = stages.map(([key, label, from, to]) => {
      const reached = new Set(from.map(e => e.sessionId)), progressed = new Set(to.map(e => e.sessionId));
      const abandoned = [...reached].filter(id => sessionMap.get(id).ended && !progressed.has(id)).length;
      return { key, label, starts: reached.size, abandoned, rate: rate(abandoned, reached.size) };
    });
    const travelDates = groupSearches(e => e.travelDate, e => e.travelDate).map(r => ({ date: r.key, searches: r.searches, users: r.users })).sort((a, b) => b.searches - a.searches || a.date.localeCompare(b.date));
    const durationGroups = new Map();
    for (const e of searches) { const count = e.service === 'hotel' ? e.stayNights : e.service === 'package' ? e.packageDays : null; if (!Number.isInteger(count) || count < 1) continue; const key = e.service + ':' + count; if (!durationGroups.has(key)) durationGroups.set(key, []); durationGroups.get(key).push(e); }
    const durations = [...durationGroups].map(([key, rows]) => ({ key, label: `${rows[0].service === 'hotel' ? rows[0].stayNights : rows[0].packageDays} ${rows[0].service === 'hotel' ? 'ليالٍ فندقية' : 'أيام للباقة'}`, service: rows[0].service, searches: rows.length, users: distinct(rows, e => e.who) })).sort((a, b) => b.searches - a.searches || a.key.localeCompare(b.key));
    const campaigns = [];
    for (const [id, metadata] of normalized.campaigns) for (const currency of ['USD', 'IQD']) {
      const matching = ads.filter(e => e.campaignId === id && e.currency === currency), attributed = searches.filter(e => e.campaignId === id && e.currency === currency);
      if (!matching.length && !attributed.length) continue;
      const attributedIds = new Set(attributed.map(e => e.id)), converted = confirmed.filter(b => attributedIds.has(b.search.id));
      const clicks = matching.filter(e => e.type === 'campaign_click');
      const cost = round(clicks.reduce((sum, e) => sum + e.cost, 0), currency), revenue = round(converted.reduce((sum, b) => sum + b.amount, 0), currency);
      campaigns.push({ key: id + ':' + currency, label: metadata.label, currency, impressions: matching.filter(e => e.type === 'campaign_impression').length, clicks: clicks.length, visits: distinct(clicks, e => e.sessionId), ...searchSummary(attributed), requests: requests.filter(r => attributedIds.has(r.search.id)).length, cost, revenue, roas: cost > 0 ? revenue / cost : null });
    }
    const offers = [...normalized.offers].map(([id, metadata]) => {
      const matching = promotions.filter(e => e.offerId === id), attributed = searches.filter(e => e.offerId === id), attributedIds = new Set(attributed.map(e => e.id));
      const applied = confirmed.filter(b => b.offerId === id && b.discountPercent === metadata.discountPercent);
      return { key: id, label: metadata.label, discountPercent: metadata.discountPercent, impressions: matching.filter(e => e.type === 'offer_impression').length, clicks: matching.filter(e => e.type === 'offer_click').length, ...searchSummary(attributed, applied), requests: requests.filter(r => attributedIds.has(r.search.id)).length };
    }).filter(row => row.impressions || row.clicks || row.searches);
    const conversionServices = Object.entries(serviceLabels).filter(([key]) => service === 'all' || service === key).map(([key, label]) => ({ key, label, ...searchSummary(searches.filter(e => e.service === key)) }));
    const summary = { ...searchSummary(searches), zeroSearches: searches.filter(e => e.resultCount === 0).length, zeroRate: rate(searches.filter(e => e.resultCount === 0).length, searches.length), checkoutStarts: distinct(checkouts, e => e.sessionId), abandoned: abandonment.find(s => s.key === 'checkout').abandoned };
    return { period: { startDate, endDate, platform, service }, summary, destinations, routes, items, zeroResults, abandonment, travelDates, durations, campaigns, offers, conversionServices };
  }

  const api = { createDemo, report, serviceLabels };
  globalThis.YARBehaviorData = api;
  if (typeof window !== 'undefined') window.YARBehaviorData = api;
})();
