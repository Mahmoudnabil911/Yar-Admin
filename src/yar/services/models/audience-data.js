(() => {
  'use strict';

  const platforms = { ios: 'iOS', android: 'Android' };
  const sources = { direct: 'مباشر', campaign: 'حملة إعلانية', referral: 'إحالة' };
  const services = { flight: 'الطيران', hotel: 'الفنادق', package: 'الباقات', transfer: 'النقل' };
  const funnelStages = [
    { key: 'visit', label: 'الزيارة' }, { key: 'search', label: 'البحث' },
    { key: 'details', label: 'عرض التفاصيل' }, { key: 'checkout', label: 'بدء الحجز' },
    { key: 'request', label: 'إرسال الطلب' },
  ];
  const array = value => Array.isArray(value) ? value : [];
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const clone = value => JSON.parse(JSON.stringify(value));
  const rate = (part, total) => total > 0 ? part / total * 100 : null;

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
    const date = new Date(value + 'T00:00:00.000Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function today() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Baghdad', calendar: 'gregory', numberingSystem: 'latn',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function shiftDate(date, days) {
    if (!validDate(date) || !Number.isInteger(days)) throw new RangeError('استخدم تاريخًا صحيحًا وعدد أيام صحيحًا.');
    const shifted = new Date(date + 'T00:00:00.000Z');
    shifted.setUTCDate(shifted.getUTCDate() + days);
    if (!Number.isFinite(shifted.getTime())) throw new RangeError('التاريخ المطلوب خارج النطاق المتاح.');
    const result = shifted.toISOString().slice(0, 10);
    if (!validDate(result)) throw new RangeError('التاريخ المطلوب خارج النطاق المتاح.');
    return result;
  }

  function createDemo(anchor = today()) {
    if (!validDate(anchor)) throw new RangeError('اختر تاريخًا صحيحًا لإنشاء بيانات المعاينة.');
    const names = [
      'نور الربيعي', 'علي النخيل', 'ليان السرو', 'عمر الجوري', 'مريم الواحة', 'حسن الندى',
      'هدى الأفق', 'سامر الياسمين', 'زينب النور', 'يوسف الورد', 'رنا الرافدين', 'أحمد السحاب',
      'سارة النسيم', 'محمد الريحان', 'سجى اليسر', 'حيدر الدار', 'دانية الهديل', 'مصطفى الهلال',
      'بتول الغدير', 'كرار الروضة', 'شهد الرونق', 'مهند الصفاء', 'ياسمين النبع', 'سيف الربيع',
    ];
    const cities = ['بغداد', 'البصرة', 'النجف', 'كربلاء', 'الموصل', 'أربيل', 'الناصرية', 'الحلة'];
    const sourceKeys = ['direct', 'campaign', 'direct', 'referral'];
    const users = names.map((name, index) => ({
      id: `user-demo-${String(index + 1).padStart(3, '0')}`, name,
      phone: `07XX XXX XX${String(index + 1).padStart(2, '0')}`,
      city: cities[index % cities.length],
      createdAt: shiftDate(anchor, -29 + Math.floor(index * 29 / (names.length - 1))),
      platform: index % 3 === 0 ? 'ios' : 'android',
      source: sourceKeys[index % sourceKeys.length],
      status: index === 6 || index === 21 ? 'suspended' : 'active',
    }));
    const sessions = [];
    let identifiedRequests = 0;
    const stagePattern = [1, 2, 3, 2, 4, 5, 2, 3, 1, 4, 3, 5];
    const serviceKeys = Object.keys(services);
    for (let day = 0; day < 30; day += 1) {
      const date = shiftDate(anchor, day - 29);
      const eligible = users.filter(user => user.createdAt <= date);
      for (let slot = 0; slot < 6; slot += 1) {
        const index = day * 6 + slot;
        let user = null;
        let visitorId;
        let platform;
        if (slot === 0 || slot === 3 || (slot === 5 && day % 4 !== 0)) {
          const device = slot === 0 ? 1 + day % 8 : slot === 3 ? 100 + day : 40 + day % 10;
          visitorId = `browser-demo-${String(device).padStart(3, '0')}`;
          platform = device % 3 === 0 ? 'ios' : 'android';
        } else if (slot === 1) {
          // The same browser can visit anonymously first and sign in in a later session.
          const device = 20 + day % 6;
          visitorId = `browser-demo-${String(device).padStart(3, '0')}`;
          platform = device % 3 === 0 ? 'ios' : 'android';
          if (day >= 10) user = eligible[(day * 2) % eligible.length];
        } else {
          user = eligible[(day + slot * 3) % eligible.length];
          const secondary = slot === 4 && day % 5 === 0;
          visitorId = `browser-member-${user.id.slice(-3)}-${secondary ? 'b' : 'a'}`;
          platform = secondary ? (user.platform === 'ios' ? 'android' : 'ios') : user.platform;
        }
        const stage = stagePattern[(day * 7 + slot * 3) % stagePattern.length];
        const requestStatus = stage === 5
          ? (user ? ['pending', 'confirmed', 'confirmed', 'cancelled'][identifiedRequests++ % 4] : 'pending')
          : null;
        sessions.push({
          id: `session-demo-${String(index + 1).padStart(4, '0')}`,
          visitorId, userId: user?.id || null, date, platform,
          source: sourceKeys[(day + slot) % sourceKeys.length],
          service: serviceKeys[(day + slot) % serviceKeys.length],
          stage, durationSec: stage * 40 + (day * 31 + slot * 47) % 180,
          requestId: stage === 5 ? `REQ-DEMO-${String(index + 1).padStart(4, '0')}` : null,
          requestStatus,
        });
      }
    }
    return { users, sessions };
  }

  function usersOf(data) {
    const users = new Map();
    for (const user of array(data?.users)) {
      if (user && typeof user.id === 'string' && user.id && validDate(user.createdAt) && has(platforms, user.platform) && !users.has(user.id)) users.set(user.id, user);
    }
    return [...users.values()];
  }

  function sessionsOf(data) {
    const sessions = new Map();
    for (const source of array(data?.sessions)) {
      if (!source || typeof source.id !== 'string' || !source.id || !validDate(source.date)) continue;
      if (!has(platforms, source.platform) || !has(sources, source.source) || !has(services, source.service)) continue;
      if (!Number.isInteger(source.stage) || source.stage < 1 || source.stage > 5) continue;
      const session = {
        ...source,
        userId: typeof source.userId === 'string' && source.userId ? source.userId : null,
        visitorId: typeof source.visitorId === 'string' ? source.visitorId : '',
        durationSec: typeof source.durationSec === 'number' && Number.isFinite(source.durationSec) && source.durationSec >= 0 ? source.durationSec : 0,
      };
      const previous = sessions.get(session.id);
      // A repeated session record is one visit; keep its furthest recorded stage.
      if (!previous || session.stage >= previous.stage) sessions.set(session.id, session);
    }
    return [...sessions.values()];
  }

  function platformFilter(value) {
    const platform = value || 'all';
    if (platform !== 'all' && !has(platforms, platform)) throw new RangeError('اختر جميع الأنظمة أو iOS أو Android.');
    return platform;
  }

  function range(filters, defaultEnd, defaultStart) {
    const end = filters.endDate || defaultEnd;
    const start = filters.startDate || defaultStart || shiftDate(end, -29);
    if (!validDate(start) || !validDate(end) || start > end) throw new RangeError('اختر فترة صحيحة، على أن يكون تاريخ النهاية مساويًا لتاريخ البداية أو بعده.');
    return { start, end };
  }

  function report(data, filters = {}) {
    filters = filters || {};
    const users = usersOf(data);
    const allSessions = sessionsOf(data);
    const latest = [...users.map(user => user.createdAt), ...allSessions.map(session => session.date)].sort().at(-1) || today();
    const { start, end } = range(filters, latest);
    const platform = platformFilter(filters.platform);
    const platformMatches = record => platform === 'all' || record.platform === platform;
    const inPeriod = record => record.date >= start && record.date <= end && platformMatches(record);
    const sessions = allSessions.filter(inPeriod);
    const newUsers = users.filter(user => user.createdAt >= start && user.createdAt <= end && platformMatches(user));
    const userIds = new Set(users.map(user => user.id));
    const activeIds = new Set(sessions.filter(session => session.userId && userIds.has(session.userId)).map(session => session.userId));
    const anonymous = sessions.filter(session => !session.userId);
    const anonymousDevices = new Set(anonymous.map(session => session.visitorId).filter(Boolean));
    const previousDevices = new Set(allSessions.filter(session => session.date < start && platformMatches(session)).map(session => session.visitorId).filter(Boolean));
    const requests = sessions.filter(session => session.stage === 5);
    const days = new Map();
    for (let date = start; ; date = shiftDate(date, 1)) {
      days.set(date, { date, sessions: 0, newAccounts: 0, requests: 0 });
      if (date === end) break;
    }
    for (const session of sessions) {
      const day = days.get(session.date);
      day.sessions += 1;
      if (session.stage === 5) day.requests += 1;
    }
    for (const user of newUsers) days.get(user.createdAt).newAccounts += 1;
    const breakdown = (labels, field) => Object.entries(labels).map(([key, label]) => {
      const matching = sessions.filter(session => session[field] === key);
      return {
        key, label, sessions: matching.length, anonymousSessions: matching.filter(session => !session.userId).length,
        requests: matching.filter(session => session.stage === 5).length, share: rate(matching.length, sessions.length) ?? 0,
      };
    });
    const funnel = funnelStages.map((stage, index) => ({
      ...stage, count: sessions.filter(session => session.stage >= index + 1).length,
    })).map((stage, index, stages) => ({
      ...stage, previousRate: index ? rate(stage.count, stages[index - 1].count) : null,
      overallRate: rate(stage.count, sessions.length),
    }));
    return {
      newAccounts: newUsers.length, activeAccounts: activeIds.size, sessions: sessions.length,
      anonymousSessions: anonymous.length, identifiedSessions: sessions.length - anonymous.length,
      anonymousDevices: anonymousDevices.size,
      returningAnonymousDevices: [...anonymousDevices].filter(id => previousDevices.has(id)).length,
      requests: requests.length, requestRate: rate(requests.length, sessions.length),
      avgDurationSec: sessions.length ? sessions.reduce((sum, session) => sum + session.durationSec, 0) / sessions.length : 0,
      trend: [...days.values()], sources: breakdown(sources, 'source'), platforms: breakdown(platforms, 'platform'),
      services: breakdown(services, 'service'), funnel,
    };
  }

  function augmentedUser(user, sessions, statuses) {
    const activity = sessions.filter(session => session.userId === user.id);
    const override = statuses && typeof statuses === 'object' ? statuses[user.id] : null;
    return {
      ...clone(user), status: override === 'active' || override === 'suspended' ? override : user.status,
      lastActivity: activity.map(session => session.date).sort().at(-1) || null,
      requestCount: activity.filter(session => session.stage === 5).length,
    };
  }

  function normalized(value) {
    return String(value ?? '').normalize('NFKD').toLowerCase()
      .replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');
  }

  function listUsers(data, filters = {}, statuses) {
    filters = filters || {};
    const platform = platformFilter(filters.platform);
    const start = filters.startDate || '';
    const end = filters.endDate || '';
    if ((start && !validDate(start)) || (end && !validDate(end)) || (start && end && start > end)) throw new RangeError('اختر فترة تسجيل صحيحة للحسابات.');
    const query = normalized(filters.query || '').trim();
    const sessions = sessionsOf(data);
    const overrides = statuses || filters.statuses || filters.statusOverrides;
    return usersOf(data).map(user => augmentedUser(user, sessions, overrides)).filter(user => {
      if (platform !== 'all' && user.platform !== platform) return false;
      if (start && user.createdAt < start) return false;
      if (end && user.createdAt > end) return false;
      if (filters.city && filters.city !== 'all' && user.city !== filters.city) return false;
      if (filters.status && filters.status !== 'all' && user.status !== filters.status) return false;
      return !query || normalized([user.id, user.name, user.phone, user.city].join(' ')).includes(query);
    }).sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id));
  }

  function userDetail(data, id) {
    const user = usersOf(data).find(item => item.id === id);
    if (!user) return null;
    const sessions = sessionsOf(data).filter(session => session.userId === id)
      .sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id));
    return {
      user: augmentedUser(user, sessions), sessions: clone(sessions),
      requests: clone(sessions.filter(session => session.stage === 5)),
    };
  }

  const api = { createDemo, today, shiftDate, report, listUsers, userDetail };
  globalThis.YARAudienceData = api;
  if (typeof window !== 'undefined') window.YARAudienceData = api;
})();
