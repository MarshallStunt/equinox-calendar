/* Shared rendering + settings for the popup and the full-year page. */
(function () {
  'use strict';
  const { MONTH_LEN, MONTHS } = EqCal;
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const GREG_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DEFAULTS = { hemisphere: 'north', showGregorian: true, showMoon: true, theme: 'system', mode: 'fixed' };

  /* ---- Theme: 'system' | 'light' | 'dark' ----
   * Applied synchronously from a localStorage copy so pages don't flash,
   * then confirmed from synced settings once they load. */
  const THEMES = ['system', 'light', 'dark'];
  const THEME_ICON = { system: '◐', light: '☀︎', dark: '☾' };
  const THEME_LABEL = { system: 'Theme: match system', light: 'Theme: light', dark: 'Theme: dark' };
  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
    else delete root.dataset.theme;
    try { localStorage.setItem('eqcal-theme', theme); } catch {}
  }
  try { applyTheme(localStorage.getItem('eqcal-theme') || 'system'); } catch {}

  const hasStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync;

  function loadSettings() {
    if (!hasStorage) {
      try {
        const s = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('eqcal') || '{}') };
        applyTheme(s.theme);
        return Promise.resolve(s);
      }
      catch { return Promise.resolve({ ...DEFAULTS }); }
    }
    return chrome.storage.sync.get(DEFAULTS).then((s) => { applyTheme(s.theme); return s; });
  }

  /** A button that cycles the theme. Calls onChange after saving. */
  function themeButton(settings) {
    const btn = el('button', 'theme-btn');
    btn.type = 'button';
    const sync = () => {
      btn.textContent = THEME_ICON[settings.theme] || THEME_ICON.system;
      btn.title = THEME_LABEL[settings.theme] || THEME_LABEL.system;
      btn.setAttribute('aria-label', btn.title);
    };
    btn.onclick = async () => {
      const i = THEMES.indexOf(settings.theme);
      settings.theme = THEMES[(i + 1) % THEMES.length];
      applyTheme(settings.theme);
      sync();
      await saveSettings(settings);
    };
    sync();
    return btn;
  }

  function saveSettings(s) {
    if (!hasStorage) { try { localStorage.setItem('eqcal', JSON.stringify(s)); } catch {} return Promise.resolve(); }
    return chrome.storage.sync.set(s);
  }

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  const gregShort = (d) => `${GREG_MONTHS[d.getMonth()]} ${d.getDate()}`;
  const fmtTime = (d) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  /**
   * SVG of the moon at a point in its cycle (0 = new, 0.5 = full).
   * Lit limb is on the right while waxing in the north; mirrored in the south.
   */
  function moonSVG(cycle, size, hemisphere) {
    const NS = 'http://www.w3.org/2000/svg';
    const r = 10;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-11 -11 22 22');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.classList.add('moon');
    const disc = document.createElementNS(NS, 'circle');
    disc.setAttribute('r', r);
    disc.setAttribute('class', 'moon-dark');
    svg.append(disc);
    const p = ((cycle % 1) + 1) % 1;
    const rx = Math.abs(Math.cos(2 * Math.PI * p)) * r;
    const waxing = p < 0.5;
    const crescent = p < 0.25 || p > 0.75;
    const outer = waxing ? 1 : 0;              // sweep of the bright limb
    const term = waxing === crescent ? 0 : 1;  // sweep of the terminator
    const lit = document.createElementNS(NS, 'path');
    lit.setAttribute('d', `M0 ${-r} A${r} ${r} 0 0 ${outer} 0 ${r} A${rx.toFixed(3)} ${r} 0 0 ${term} 0 ${-r}Z`);
    lit.setAttribute('class', 'moon-lit');
    if (hemisphere === 'south') lit.setAttribute('transform', 'scale(-1 1)');
    svg.append(lit);
    const rim = document.createElementNS(NS, 'circle');
    rim.setAttribute('r', r);
    rim.setAttribute('class', 'moon-rim');
    svg.append(rim);
    return svg;
  }

  /** Build a month grid element. In fixed mode, month 14 = Threshold Days. */
  function renderMonth(year, month, settings, opts = {}) {
    const { hemisphere, mode } = settings;
    const info = EqCal.yearInfo(year, hemisphere, mode);
    const mo = info.months[month - 1];
    const todayNum = EqCal.localDayNum(new Date());
    const isThreshold = mo.isThreshold;
    const count = mo.length;

    const wrap = el('section', 'month' + (isThreshold ? ' threshold' : ''));
    if (opts.title !== false) {
      const head = el('header', 'month-head');
      head.append(el('span', 'month-num', isThreshold ? '✦' : String(month)));
      head.append(el('span', 'month-name', mo.name));
      const first = EqCal.dateFromDayNum(mo.startDay);
      const last = EqCal.dateFromDayNum(mo.startDay + count - 1);
      head.append(el('span', 'month-range', `${gregShort(first)} – ${gregShort(last)}`));
      wrap.append(head);
    }

    // Principal lunar phases falling in this month, keyed by local day number.
    const majors = new Map();
    if (settings.showMoon) {
      const from = EqCal.dateFromDayNum(mo.startDay);
      const to = EqCal.dateFromDayNum(mo.startDay + count);
      for (const ph of EqCal.lunarPhasesBetween(+from, +to)) majors.set(EqCal.localDayNum(ph.date), ph);
    }

    // Fixed months always start on the year's first weekday; lunar months start anywhere,
    // so they use a Sunday-first week with blank leading cells.
    const lunar = mode === 'lunar';
    const firstCol = lunar ? 0 : info.firstWeekday;
    const grid = el('div', 'grid');
    for (let i = 0; i < 7; i++) grid.append(el('div', 'wd', WEEKDAYS[(firstCol + i) % 7]));
    if (lunar) {
      const lead = EqCal.dateFromDayNum(mo.startDay).getDay();
      for (let i = 0; i < lead; i++) grid.append(el('div', 'cell blank'));
    }
    for (let d = 1; d <= count; d++) {
      const n = mo.startDay + d - 1;
      const date = EqCal.dateFromDayNum(n);
      const cell = el('div', 'cell');
      if (n === todayNum) cell.classList.add('today');
      else if (n < todayNum) cell.classList.add('past');
      cell.append(el('span', 'd', String(d)));
      if (settings.showGregorian) cell.append(el('span', 'g', gregShort(date)));
      let tip = `${EqCal.format(EqCal.fromDate(date, hemisphere, mode))}\n${date.toDateString()}`;
      if (settings.showMoon) {
        const major = majors.get(n);
        const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
        const moon = EqCal.moonAt(major ? major.date : noon);
        const icon = moonSVG(moon.cycle, major ? 12 : 9, hemisphere);
        if (major) {
          cell.classList.add('moon-major');
          tip += `\n${major.name} at ${fmtTime(major.date)}`;
        } else {
          tip += `\n${moon.name}, ${Math.round(moon.illumination * 100)}% lit`;
        }
        icon.classList.add(major ? 'moon-big' : 'moon-small');
        cell.append(icon);
      }
      cell.title = tip;
      grid.append(cell);
    }
    wrap.append(grid);
    return wrap;
  }

  /** Name of the calendar for the current mode, e.g. "Equinox Year" / "Lunar Year". */
  const yearWord = (settings) => (settings.mode === 'lunar' ? 'Lunar Year' : 'Equinox Year');

  function daysUntil(date) {
    return EqCal.localDayNum(date) - EqCal.localDayNum(new Date());
  }

  function fmtInstant(d) {
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  }

  window.EqUI = { yearWord, themeButton, applyTheme, loadSettings, saveSettings, renderMonth, el, daysUntil, fmtInstant, gregShort, fmtTime, moonSVG };
})();
