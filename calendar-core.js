/*
 * Equinox Calendar core.
 *
 * A 13-month year: 13 months x 28 days = 364 days, followed by 1 or 2
 * "Threshold Days" that close the year. Each year begins on the local
 * calendar date of the spring equinox (March in the north, September in
 * the south), so the year length is whatever the real equinox-to-equinox
 * span is (365 or 366 days).
 *
 * Because every month is exactly 4 weeks, every month in a given year
 * starts on the same real weekday: the weekday of that year's equinox.
 */
(function (root) {
  'use strict';

  const MONTH_LEN = 28;
  const MONTHS = 13;
  const DAY_MS = 86400000;

  const MONTH_NAMES = [
    'Aurora', 'Flora', 'Verdis', 'Solara', 'Aestas', 'Calora', 'Messis',
    'Vindemia', 'Brumis', 'Umbra', 'Glacia', 'Nivis', 'Renova',
  ];
  const THRESHOLD_NAME = 'Threshold';

  // Periodic terms for equinox/solstice correction (Meeus, Astronomical Algorithms, ch. 27).
  const TERMS = [
    [485, 324.96, 1934.136], [203, 337.23, 32964.467], [199, 342.08, 20.186],
    [182, 27.85, 445267.112], [156, 73.14, 45036.886], [136, 171.52, 22518.443],
    [77, 222.54, 65928.934], [74, 296.72, 3034.906], [70, 243.58, 9037.513],
    [58, 119.81, 33718.147], [52, 297.17, 150.678], [50, 21.02, 2281.226],
    [45, 247.54, 29929.562], [44, 325.15, 31555.956], [29, 60.93, 4443.417],
    [18, 155.12, 67555.328], [17, 288.79, 4562.452], [16, 198.04, 62894.029],
    [14, 199.76, 31436.921], [12, 95.39, 14577.848], [12, 287.11, 31931.756],
    [12, 320.81, 34777.259], [9, 227.73, 1222.114], [8, 15.45, 16859.074],
  ];

  const rad = (d) => (d * Math.PI) / 180;

  // Mean equinox/solstice polynomials, years 1000–3000 (Meeus table 27.B).
  const SEASON_COEFFS = {
    march: [2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057],
    june: [2451716.56767, 365241.62603, 0.00325, 0.00888, -0.0003],
    september: [2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078],
    december: [2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032],
  };

  /** Instant of the equinox (ms since epoch, UTC). which: 'march' | 'september'. */
  function equinoxInstant(year, which) {
    const Y = (year - 2000) / 1000;
    const C = SEASON_COEFFS[which] || SEASON_COEFFS.march;
    const jde0 = C[0] + C[1] * Y + C[2] * Y * Y + C[3] * Y ** 3 + C[4] * Y ** 4;
    const T = (jde0 - 2451545.0) / 36525;
    const W = 35999.373 * T - 2.47;
    const dL = 1 + 0.0334 * Math.cos(rad(W)) + 0.0007 * Math.cos(rad(2 * W));
    let S = 0;
    for (const [A, B, C] of TERMS) S += A * Math.cos(rad(B + C * T));
    const jde = jde0 + (0.00001 * S) / dL;
    const deltaT = 69 / 86400; // TT - UTC, close enough for this century
    return (jde - deltaT - 2440587.5) * DAY_MS;
  }

  /** Whole-day number for a local calendar date (DST-proof). */
  const dayNum = (y, m, d) => Math.round(Date.UTC(y, m, d) / DAY_MS);
  const localDayNum = (date) => dayNum(date.getFullYear(), date.getMonth(), date.getDate());
  const dateFromDayNum = (n) => {
    const u = new Date(n * DAY_MS);
    return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
  };

  const springKey = (hemisphere) => (hemisphere === 'south' ? 'september' : 'march');
  const springInstant = (year, hemisphere) => equinoxInstant(year, springKey(hemisphere));

  /**
   * Two ways to divide the equinox year:
   *  'fixed' — 13 months x 28 days from the equinox day, then 1–2 Threshold Days.
   *  'lunar' — the year starts at the first new moon on or after the equinox and every
   *            month runs from one new moon to the next (29–30 days), so a year has
   *            12 months, or 13 when a 13th new moon arrives before the next equinox.
   */
  function lunarYearStartK(year, hemisphere) {
    const eq = springInstant(year, hemisphere);
    let k = lunationAt(eq);
    if (lunarPhaseInstant(k) < eq) k += 1;
    return k;
  }

  function yearStartDay(year, hemisphere, mode) {
    if (mode === 'lunar') return localDayNum(new Date(lunarPhaseInstant(lunarYearStartK(year, hemisphere))));
    return localDayNum(new Date(springInstant(year, hemisphere)));
  }

  const layoutCache = new Map();

  /** Full description of a year, including its list of months. */
  function yearInfo(year, hemisphere, mode = 'fixed') {
    const key = `${year}|${hemisphere}|${mode}`;
    if (layoutCache.has(key)) return layoutCache.get(key);
    const months = [];
    let start, next, thresholdDays = 0;
    if (mode === 'lunar') {
      const k0 = lunarYearStartK(year, hemisphere);
      const k1 = lunarYearStartK(year + 1, hemisphere);
      const day = (k) => localDayNum(new Date(lunarPhaseInstant(k)));
      for (let k = k0; k < k1; k++) {
        months.push({
          m: k - k0 + 1, startDay: day(k), length: day(k + 1) - day(k),
          newMoon: new Date(lunarPhaseInstant(k)), isThreshold: false,
        });
      }
      start = day(k0);
      next = day(k1);
    } else {
      start = yearStartDay(year, hemisphere, 'fixed');
      next = yearStartDay(year + 1, hemisphere, 'fixed');
      for (let m = 1; m <= MONTHS; m++) {
        months.push({ m, startDay: start + (m - 1) * MONTH_LEN, length: MONTH_LEN, isThreshold: false });
      }
      thresholdDays = next - start - MONTHS * MONTH_LEN;
      if (thresholdDays > 0) {
        months.push({ m: MONTHS + 1, startDay: start + MONTHS * MONTH_LEN, length: thresholdDays, isThreshold: true });
      }
    }
    for (const mo of months) mo.name = monthName(mo.m, mode);
    const info = {
      year, hemisphere, mode, months,
      startDay: start,
      length: next - start,
      thresholdDays,
      monthCount: months.filter((mo) => !mo.isThreshold).length,
      equinox: new Date(springInstant(year, hemisphere)),
      nextEquinox: new Date(springInstant(year + 1, hemisphere)),
      firstWeekday: dateFromDayNum(start).getDay(),
    };
    layoutCache.set(key, info);
    return info;
  }

  /** Convert a JS Date to a calendar date in the given mode. */
  function fromDate(date, hemisphere, mode = 'fixed') {
    const today = localDayNum(date);
    let year = date.getFullYear();
    if (today < yearStartDay(year, hemisphere, mode)) year -= 1;
    const info = yearInfo(year, hemisphere, mode);
    const dayOfYear = today - info.startDay; // 0-based
    const mo = info.months.find((x) => today >= x.startDay && today < x.startDay + x.length)
      || info.months[info.months.length - 1];
    return {
      year, month: mo.m, day: today - mo.startDay + 1, dayOfYear: dayOfYear + 1,
      isThreshold: mo.isThreshold, info, monthInfo: mo,
      monthName: mo.name,
      weekday: date.getDay(),
      weekOfYear: Math.floor(dayOfYear / 7) + 1,
    };
  }

  /** Gregorian Date for a calendar date. In fixed mode, month 14 = Threshold Days. */
  function toDate(year, month, day, hemisphere, mode = 'fixed') {
    const info = yearInfo(year, hemisphere, mode);
    const mo = info.months[month - 1];
    const startDay = mo ? mo.startDay : info.startDay + (month - 1) * MONTH_LEN;
    return dateFromDayNum(startDay + (day - 1));
  }

  function monthName(m, mode = 'fixed') {
    if (mode !== 'lunar' && m === MONTHS + 1) return THRESHOLD_NAME;
    return MONTH_NAMES[m - 1];
  }

  /** Short label, e.g. "Messis 14, 2026". */
  function format(d) {
    return d.isThreshold
      ? `Threshold Day ${d.day}, ${d.year}`
      : `${d.monthName} ${d.day}, ${d.year}`;
  }

  /**
   * The sun's four turning points that fall inside a year, in order, named for the
   * hemisphere's own seasons. Each has { key, name, season (0 spring … 3 winter), date, dayOfYear }.
   */
  function seasonMarkers(year, hemisphere, mode = 'fixed') {
    const info = yearInfo(year, hemisphere, mode);
    const south = hemisphere === 'south';
    const seasonOf = { march: 0, june: 1, september: 2, december: 3 };
    const names = ['Spring equinox', 'Summer solstice', 'Autumn equinox', 'Winter solstice'];
    const out = [];
    for (const y of [year, year + 1]) {
      for (const which of ['march', 'june', 'september', 'december']) {
        const date = new Date(equinoxInstant(y, which));
        const d = localDayNum(date) - info.startDay;
        if (d < 0 || d >= info.length) continue;
        const season = south ? (seasonOf[which] + 2) % 4 : seasonOf[which];
        out.push({ key: which, name: names[season], season, date, dayOfYear: d + 1 });
      }
    }
    return out.sort((x, y) => x.date - y.date);
  }

  /* ---------------- Moon (Meeus, Astronomical Algorithms, ch. 49) ---------------- */

  const SYNODIC = 29.530588861;
  const sin = (d) => Math.sin(rad(d));
  const cos = (d) => Math.cos(rad(d));
  const PLANETARY = [
    [325, 299.77, 0.107408, -0.009173], [165, 251.88, 0.016321], [164, 251.83, 26.651886],
    [126, 349.42, 36.412478], [110, 84.66, 18.206239], [62, 141.74, 53.303771],
    [60, 207.14, 2.453732], [56, 154.84, 7.306860], [47, 34.52, 27.261239],
    [42, 207.19, 0.121824], [40, 291.34, 1.844379], [37, 161.72, 24.198154],
    [35, 239.56, 25.513099], [23, 331.55, 3.592518],
  ];

  /**
   * Instant (ms, UTC) of the lunar phase with lunation number k.
   * Integer k = new moon, +0.25 first quarter, +0.5 full, +0.75 last quarter.
   */
  function lunarPhaseInstant(k) {
    const T = k / 1236.85;
    const T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    let jde = 2451550.09766 + SYNODIC * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
    const E = 1 - 0.002516 * T - 0.0000074 * T2;
    const M = 2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3;
    const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4;
    const F = 160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4;
    const Om = 124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3;
    const phase = Math.round((k - Math.floor(k)) * 4) % 4; // 0 new, 1 FQ, 2 full, 3 LQ
    let c = 0;
    if (phase === 0 || phase === 2) {
      const full = phase === 2;
      c += (full ? -0.40614 : -0.4072) * sin(Mp)
        + (full ? 0.17302 : 0.17241) * E * sin(M)
        + (full ? 0.01614 : 0.01608) * sin(2 * Mp)
        + (full ? 0.01043 : 0.01039) * sin(2 * F)
        + (full ? 0.00734 : 0.00739) * E * sin(Mp - M)
        + (full ? -0.00515 : -0.00514) * E * sin(Mp + M)
        + (full ? 0.00209 : 0.00208) * E * E * sin(2 * M)
        - 0.00111 * sin(Mp - 2 * F) - 0.00057 * sin(Mp + 2 * F)
        + 0.00056 * E * sin(2 * Mp + M) - 0.00042 * sin(3 * Mp)
        + 0.00042 * E * sin(M + 2 * F) + 0.00038 * E * sin(M - 2 * F)
        - 0.00024 * E * sin(2 * Mp - M) - 0.00017 * sin(Om)
        - 0.00007 * sin(Mp + 2 * M) + 0.00004 * sin(2 * Mp - 2 * F)
        + 0.00004 * sin(3 * M) + 0.00003 * sin(Mp + M - 2 * F)
        + 0.00003 * sin(2 * Mp + 2 * F) - 0.00003 * sin(Mp + M + 2 * F)
        + 0.00003 * sin(Mp - M + 2 * F) - 0.00002 * sin(Mp - M - 2 * F)
        - 0.00002 * sin(3 * Mp + M) + 0.00002 * sin(4 * Mp);
    } else {
      c += -0.62801 * sin(Mp) + 0.17172 * E * sin(M) - 0.01183 * E * sin(Mp + M)
        + 0.00862 * sin(2 * Mp) + 0.00804 * sin(2 * F) + 0.00454 * E * sin(Mp - M)
        + 0.00204 * E * E * sin(2 * M) - 0.0018 * sin(Mp - 2 * F) - 0.0007 * sin(Mp + 2 * F)
        - 0.0004 * sin(3 * Mp) - 0.00034 * E * sin(2 * Mp - M) + 0.00032 * E * sin(M + 2 * F)
        + 0.00032 * E * sin(M - 2 * F) - 0.00028 * E * E * sin(Mp + 2 * M) + 0.00027 * E * sin(2 * M)
        - 0.00017 * sin(Om) - 0.00005 * sin(Mp - M - 2 * F) + 0.00004 * sin(2 * Mp + 2 * F)
        - 0.00004 * sin(Mp + M + 2 * F) + 0.00004 * sin(Mp - 2 * M) + 0.00003 * sin(Mp + M - 2 * F)
        + 0.00003 * sin(3 * M) + 0.00002 * sin(2 * Mp - 2 * F) + 0.00002 * sin(Mp - M + 2 * F)
        - 0.00002 * sin(3 * Mp + M);
      const W = 0.00306 - 0.00038 * E * cos(M) + 0.00026 * cos(Mp) - 0.00002 * cos(Mp - M)
        + 0.00002 * cos(Mp + M) + 0.00002 * cos(2 * F);
      c += phase === 1 ? W : -W;
    }
    for (const [a, b, r, q = 0] of PLANETARY) c += 0.000001 * a * sin(b + r * k + q * T2);
    jde += c;
    return (jde - 69 / 86400 - 2440587.5) * DAY_MS;
  }

  const PHASE_NAMES = ['New Moon', 'First Quarter', 'Full Moon', 'Last Quarter'];

  /** Lunation number (integer) of the new moon at or before `ms`. */
  function lunationAt(ms) {
    const years = (ms - Date.UTC(2000, 0, 6)) / (365.2422 * DAY_MS);
    let k = Math.floor(years * 12.3685);
    while (lunarPhaseInstant(k) > ms) k--;
    while (lunarPhaseInstant(k + 1) <= ms) k++;
    return k;
  }

  /** The moon's state at an instant: cycle position, illumination, name. */
  function moonAt(date) {
    const ms = +date;
    const k = lunationAt(ms);
    const prev = lunarPhaseInstant(k);
    const next = lunarPhaseInstant(k + 1);
    const cycle = (ms - prev) / (next - prev); // 0 = new, 0.5 = full
    const illumination = (1 - Math.cos(2 * Math.PI * cycle)) / 2;
    const names = ['Waxing Crescent', 'Waxing Gibbous', 'Waning Gibbous', 'Waning Crescent'];
    return {
      cycle, illumination,
      age: (ms - prev) / DAY_MS,
      name: names[Math.min(3, Math.floor(cycle * 4))],
      lunation: k,
    };
  }

  /** All principal phases between two instants: [{ type 0-3, name, date }]. */
  function lunarPhasesBetween(startMs, endMs) {
    const out = [];
    let k = lunationAt(startMs);
    for (;; k += 0.25) {
      const t = lunarPhaseInstant(k);
      if (t > endMs) break;
      if (t >= startMs) {
        const type = Math.round((k - Math.floor(k)) * 4) % 4;
        out.push({ type, name: PHASE_NAMES[type], date: new Date(t) });
      }
    }
    return out;
  }

  /** Next occurrence of a given phase type (0 new, 2 full) after a date. */
  function nextPhase(date, type) {
    const k0 = lunationAt(+date);
    for (let k = k0 + type / 4; ; k += 1) {
      const t = lunarPhaseInstant(k);
      if (t > +date) return { type, name: PHASE_NAMES[type], date: new Date(t) };
    }
  }

  root.EqCal = {
    MONTH_LEN, MONTHS, MONTH_NAMES, THRESHOLD_NAME, PHASE_NAMES,
    equinoxInstant, yearInfo, fromDate, toDate, monthName, format,
    localDayNum, dateFromDayNum, seasonMarkers,
    lunarPhaseInstant, moonAt, lunarPhasesBetween, nextPhase,
  };
})(typeof self !== 'undefined' ? self : this);
