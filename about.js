(async function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const settings = await EqUI.loadSettings();

  const MEANINGS = [
    ['Aurora', 'dawn', 'The year opens at the equinox as days overtake nights.'],
    ['Flora', 'flowers', 'Blossom and the first full flush of spring.'],
    ['Verdis', 'green', 'Leaves at full green, the land growing fast.'],
    ['Solara', 'sun', 'Holds the summer solstice, the longest day.'],
    ['Aestas', 'summer', 'High summer, the warmest stretch of the year.'],
    ['Calora', 'heat', 'Late-summer heat, days already shortening.'],
    ['Messis', 'harvest', 'Holds the autumn equinox, when grain comes in.'],
    ['Vindemia', 'grape harvest', 'Fruit and vine harvest, leaves turning.'],
    ['Brumis', 'mist, winter', 'Mist and frost as the nights grow long.'],
    ['Umbra', 'shadow', 'Holds the winter solstice, the longest night.'],
    ['Glacia', 'ice', 'Deep cold after midwinter.'],
    ['Nivis', 'snow', 'Snow season, the light visibly returning.'],
    ['Renova', 'renewal', 'Thaw and the first buds, before the equinox.'],
  ];

  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };

  function render() {
    const now = new Date();
    const { hemisphere, mode } = settings;
    const today = EqCal.fromDate(now, hemisphere, mode);
    const info = today.info;
    const markers = EqCal.seasonMarkers(today.year, hemisphere, mode);
    const L = info.length;
    const angle = (day) => (day / L) * 2 * Math.PI - Math.PI / 2; // day 0 at top, clockwise
    const pt = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];

    /* ---- Wheel ---- */
    const size = 360, R = 150, r = 104;
    const svg = svgEl('svg', { viewBox: `${-size / 2} ${-size / 2} ${size} ${size}`, class: 'wheel', role: 'img',
      'aria-label': `${EqUI.yearWord(settings)} ${today.year} as a wheel of ${info.monthCount} months` });

    const segs = info.months.map((mo) => ({
      m: mo.isThreshold ? 14 : mo.m,
      from: mo.startDay - info.startDay,
      to: mo.startDay - info.startDay + mo.length,
    }));

    for (const s of segs) {
      const a0 = angle(s.from) + 0.006, a1 = angle(s.to) - 0.006;
      const [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1), [x2, y2] = pt(r, a1), [x3, y3] = pt(r, a0);
      const large = a1 - a0 > Math.PI ? 1 : 0;
      // Colour each month by the astronomical season its midpoint falls in.
      const mid = (s.from + s.to) / 2 + 1;
      const before = markers.filter((mk) => mk.dayOfYear <= mid);
      const season = before.length ? before[before.length - 1].season
        : (markers.length ? (markers[0].season + 3) % 4 : 0);
      const cls = s.m === 14 ? 'seg threshold-seg' : `seg season-${season}`
        + (s.m === today.month ? ' current' : '');
      const path = svgEl('path', {
        d: `M${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r} ${r} 0 ${large} 0 ${x3} ${y3}Z`,
        class: cls,
      });
      const title = svgEl('title');
      title.textContent = s.m === 14 ? 'Threshold Days' : `${s.m}. ${EqCal.monthName(s.m, mode)}`;
      path.append(title);
      svg.append(path);
      if (s.m !== 14) {
        const [tx, ty] = pt((R + r) / 2, angle((s.from + s.to) / 2));
        const t = svgEl('text', { x: tx, y: ty, class: 'seg-label' + (s.m === today.month ? ' current' : '') });
        t.textContent = s.m;
        svg.append(t);
      }
    }

    // Season markers: tick + dot outside the ring.
    markers.forEach((mk) => {
      const a = angle(mk.dayOfYear - 0.5);
      const [x0, y0] = pt(r - 6, a), [x1, y1] = pt(R + 8, a), [dx, dy] = pt(R + 16, a);
      svg.append(svgEl('line', { x1: x0, y1: y0, x2: x1, y2: y1, class: 'marker-line' }));
      svg.append(svgEl('circle', { cx: dx, cy: dy, r: 6, class: `marker-dot m${mk.season}` }));
    });

    // Today hand.
    const ta = angle(today.dayOfYear - 0.5);
    const [hx, hy] = pt(R + 2, ta), [ix, iy] = pt(r - 12, ta);
    svg.append(svgEl('line', { x1: ix, y1: iy, x2: hx, y2: hy, class: 'today-hand' }));
    svg.append(svgEl('circle', { cx: hx, cy: hy, r: 4.5, class: 'today-dot' }));

    // Centre: today's moon + date.
    const moon = EqCal.moonAt(now);
    const moonIcon = EqUI.moonSVG(moon.cycle, 44, hemisphere);
    const fo = svgEl('foreignObject', { x: -22, y: -58, width: 44, height: 44 });
    fo.append(moonIcon);
    svg.append(fo);
    const c1 = svgEl('text', { x: 0, y: 8, class: 'centre-big' });
    c1.textContent = today.isThreshold ? `Threshold ${today.day}` : `${today.day} ${today.monthName}`;
    const c2 = svgEl('text', { x: 0, y: 30, class: 'centre-small' });
    c2.textContent = `Day ${today.dayOfYear} of ${L}`;
    const c3 = svgEl('text', { x: 0, y: 48, class: 'centre-small' });
    c3.textContent = moon.name;
    svg.append(c1, c2, c3);

    $('wheel').replaceChildren(svg);

    $('wheel-caption').textContent =
      mode === 'lunar'
        ? `Lunar Year ${today.year} has ${L} days in ${info.monthCount} moon-to-moon months. The hand shows `
          + `today. The colored dots mark the sun's turning points; in lunar mode they shift by up to a month `
          + `from year to year, because the year starts at a new moon rather than the equinox itself.`
        : `Equinox Year ${today.year} has ${L} days: 13 months of 28 and ${info.thresholdDays} Threshold `
          + `Day${info.thresholdDays === 1 ? '' : 's'}. The hand shows today. The colored dots mark the four `
          + `turning points of the sun, and each one lands in the same month every year.`;

    const ul = $('markers');
    ul.replaceChildren();
    markers.forEach((mk) => {
      const at = EqCal.fromDate(mk.date, hemisphere, mode);
      const li = EqUI.el('li');
      li.append(EqUI.el('span', `marker-dot-key m${mk.season}`));
      const body = EqUI.el('div');
      body.append(EqUI.el('b', null, mk.name));
      body.append(EqUI.el('div', 'sub',
        `${EqCal.format(at)} · ${mk.date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`));
      li.append(body);
      ul.append(li);
    });

    /* ---- Month list ---- */
    const ol = $('month-list');
    ol.replaceChildren();
    MEANINGS.forEach(([name, meaning, note], i) => {
      const mo = info.months[i];
      const li = EqUI.el('li', i + 1 === today.month ? 'current' : '');
      const range = mo && !mo.isThreshold
        ? `${EqUI.gregShort(EqCal.dateFromDayNum(mo.startDay))} – ${EqUI.gregShort(EqCal.dateFromDayNum(mo.startDay + mo.length - 1))}`
        : 'not in this lunar year (only 12 months)';
      li.append(EqUI.el('span', 'ml-num', String(i + 1)));
      const body = EqUI.el('div');
      const head = EqUI.el('div');
      head.append(EqUI.el('b', null, name), EqUI.el('span', 'ml-meaning', ` · “${meaning}”`));
      body.append(head, EqUI.el('div', 'sub', `${note} ${range}`));
      li.append(body);
      ol.append(li);
    });
  }

  const select = $('hemisphere');
  const navRight = EqUI.el('div', 'hero-actions');
  select.replaceWith(navRight);
  const modeSel = document.createElement('select');
  modeSel.setAttribute('aria-label', 'Month system');
  modeSel.innerHTML = '<option value="fixed">13 × 28 days</option><option value="lunar">Lunar months</option>';
  modeSel.value = settings.mode;
  modeSel.onchange = async () => { settings.mode = modeSel.value; await EqUI.saveSettings(settings); render(); };
  navRight.append(modeSel, select, EqUI.themeButton(settings));
  $('hemisphere').value = settings.hemisphere;
  $('hemisphere').onchange = async (e) => {
    settings.hemisphere = e.target.value;
    await EqUI.saveSettings(settings);
    render();
  };
  render();
})();
