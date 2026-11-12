(async function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let settings = await EqUI.loadSettings();
  const param = parseInt(new URLSearchParams(location.search).get('year'), 10);
  let year = Number.isFinite(param) ? param : EqCal.fromDate(new Date(), settings.hemisphere, settings.mode).year;

  function render() {
    const info = EqCal.yearInfo(year, settings.hemisphere, settings.mode);
    const hemi = settings.hemisphere === 'south' ? 'Southern hemisphere' : 'Northern hemisphere';
    $('eyebrow').textContent = `${hemi} · ${settings.mode === 'lunar' ? 'lunar months' : '13 × 28 days'}`;
    $('title').textContent = `${EqUI.yearWord(settings)} ${year}`;
    if (settings.mode === 'lunar') {
      const first = info.months[0].newMoon;
      $('sub').textContent = `Begins with the new moon of ${EqUI.fmtInstant(first)} (equinox ${EqUI.fmtInstant(info.equinox)})`
        + ` · ${info.length} days · ${info.monthCount} months${info.monthCount === 13 ? ' (includes Renova, the 13th month)' : ''}`;
    } else {
      $('sub').textContent = `Begins ${EqUI.fmtInstant(info.equinox)} · ${info.length} days · `
        + `${info.thresholdDays} Threshold Day${info.thresholdDays === 1 ? '' : 's'}`;
    }
    const grid = $('grid');
    grid.replaceChildren();
    info.months.forEach((mo) => grid.append(EqUI.renderMonth(year, mo.m, settings)));
    history.replaceState(null, '', `?year=${year}`);
  }

  $('prev').onclick = () => { year -= 1; render(); };
  $('next').onclick = () => { year += 1; render(); };
  $('today-btn').onclick = () => { year = EqCal.fromDate(new Date(), settings.hemisphere, settings.mode).year; render(); };
  $('hemisphere').value = settings.hemisphere;
  $('greg').checked = settings.showGregorian;
  $('hemisphere').onchange = async (e) => { settings.hemisphere = e.target.value; await EqUI.saveSettings(settings); render(); };
  $('greg').onchange = async (e) => { settings.showGregorian = e.target.checked; await EqUI.saveSettings(settings); render(); };

  document.querySelector('.controls').append(EqUI.themeButton(settings));
  $('mode').value = settings.mode;
  $('mode').onchange = async (e) => {
    settings.mode = e.target.value;
    await EqUI.saveSettings(settings);
    year = EqCal.fromDate(new Date(), settings.hemisphere, settings.mode).year;
    render();
  };
  $('moon').checked = settings.showMoon;
  $('moon').onchange = async (e) => { settings.showMoon = e.target.checked; await EqUI.saveSettings(settings); render(); };
  render();
})();
