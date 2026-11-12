(async function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let settings = await EqUI.loadSettings();
  let view; // { year, month }

  function renderHero() {
    const t = EqCal.fromDate(new Date(), settings.hemisphere, settings.mode);
    const info = t.info;
    $('eyebrow').textContent = `${EqUI.yearWord(settings)} ${t.year} · Day ${t.dayOfYear} of ${info.length}`;
    $('today').innerHTML = '';
    if (t.isThreshold) {
      $('today').append('Threshold Day ', Object.assign(EqUI.el('span', 'num', String(t.day))));
    } else {
      $('today').append(Object.assign(EqUI.el('span', 'num', String(t.day))), ` ${t.monthName}`);
    }
    const left = EqUI.daysUntil(info.nextEquinox);
    $('sub').textContent = `${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`
      + ` · next equinox in ${left} day${left === 1 ? '' : 's'}`;
    $('bar').style.width = `${(t.dayOfYear / info.length) * 100}%`;
    renderMoon();
    return t;
  }

  function renderMoon() {
    const row = $('moon-row');
    row.replaceChildren();
    row.hidden = !settings.showMoon;
    if (!settings.showMoon) return;
    const now = new Date();
    const moon = EqCal.moonAt(now);
    // Name today by its principal phase if one falls on today's date.
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const major = EqCal.lunarPhasesBetween(+start, +end)[0];
    const name = major ? `${major.name} at ${EqUI.fmtTime(major.date)}` : moon.name;
    const upcoming = [EqCal.nextPhase(now, 2), EqCal.nextPhase(now, 0)].sort((a, b) => a.date - b.date)[0];
    const days = EqUI.daysUntil(upcoming.date);
    const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
    const text = EqUI.el('div');
    text.append(EqUI.el('div', 'moon-name', name));
    text.append(EqUI.el('div', 'moon-sub',
      `${Math.round(moon.illumination * 100)}% lit · day ${Math.floor(moon.age) + 1} of the cycle · ${upcoming.name} ${when}`));
    row.append(EqUI.moonSVG(moon.cycle, 30, settings.hemisphere), text);
  }

  function renderMonth() {
    const info = EqCal.yearInfo(view.year, settings.hemisphere, settings.mode);
    const mo = info.months[view.month - 1];
    $('nav-label').textContent = mo.isThreshold
      ? `Threshold Days · ${view.year}`
      : `Month ${view.month} of ${info.monthCount} · ${view.year}`;
    $('month').replaceChildren(EqUI.renderMonth(view.year, view.month, settings));
  }

  function goToday() {
    const t = renderHero();
    view = { year: t.year, month: t.month };
    renderMonth();
  }

  function step(dir) {
    let { year, month } = view;
    const count = (y) => EqCal.yearInfo(y, settings.hemisphere, settings.mode).months.length;
    month += dir;
    if (month < 1) { year -= 1; month = count(year); }
    else if (month > count(year)) { year += 1; month = 1; }
    view = { year, month };
    renderMonth();
  }

  $('prev').onclick = () => step(-1);
  $('next').onclick = () => step(1);
  $('today-btn').onclick = goToday;
  $('year-btn').onclick = () => {
    const url = `calendar.html?year=${view.year}`;
    if (typeof chrome !== 'undefined' && chrome.tabs) chrome.tabs.create({ url: chrome.runtime.getURL(url) });
    else window.open(url);
  };
  $('hero-actions').append(EqUI.themeButton(settings));
  $('about-link').onclick = (e) => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL('about.html') });
    }
  };
  $('hemisphere').value = settings.hemisphere;
  $('greg').checked = settings.showGregorian;
  $('hemisphere').onchange = async (e) => {
    settings.hemisphere = e.target.value;
    await EqUI.saveSettings(settings);
    goToday();
  };
  $('greg').onchange = async (e) => {
    settings.showGregorian = e.target.checked;
    await EqUI.saveSettings(settings);
    renderMonth();
  };
  $('mode').value = settings.mode;
  $('mode').onchange = async (e) => {
    settings.mode = e.target.value;
    await EqUI.saveSettings(settings);
    goToday();
  };
  $('moon').checked = settings.showMoon;
  $('moon').onchange = async (e) => {
    settings.showMoon = e.target.checked;
    await EqUI.saveSettings(settings);
    renderMoon();
    renderMonth();
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  goToday();
})();
