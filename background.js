/* Keeps the toolbar badge showing today's day-of-month. */
importScripts('calendar-core.js');

async function updateBadge() {
  const { hemisphere, mode } = await chrome.storage.sync.get({ hemisphere: 'north', mode: 'fixed' });
  const t = EqCal.fromDate(new Date(), hemisphere, mode);
  await chrome.action.setBadgeText({ text: t.isThreshold ? `✦${t.day}` : String(t.day) });
  await chrome.action.setBadgeBackgroundColor({ color: t.isThreshold ? '#6b5bb5' : '#c2741a' });
  await chrome.action.setTitle({
    title: `${EqCal.format(t)} — month ${t.isThreshold ? '✦' : t.month} of ${t.info.monthCount}, day ${t.dayOfYear} of ${t.info.length}`,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('tick', { periodInMinutes: 30 });
  updateBadge();
});
chrome.runtime.onStartup.addListener(updateBadge);
chrome.alarms.onAlarm.addListener(updateBadge);
chrome.storage.onChanged.addListener(updateBadge);
