# Equinox Calendar

A Chrome extension for a calendar whose year begins at the **spring equinox**, with two ways to divide it:

- **13 × 28 days** (default): 13 identical four-week months, then 1–2 **Threshold Days** that close the year before the next equinox. Every month in a year starts on the same weekday.
- **Lunar months**: the year starts at the first new moon on or after the equinox, and each month runs from one new moon to the next (29–30 days). Most years have 12 months, and about one in three has a 13th month, Renova.

A **North / South** setting starts the year at the March or September equinox, so the year begins in spring in either hemisphere.

## Features

- **Popup:** today's date, how far through the year you are, today's moon phase, and a month grid you can step through.
- **Year view:** all months of a year on one page, with matching Gregorian dates.
- **Moon phases:** a phase drawing on every day, with new, first-quarter, full and last-quarter days outlined (hover for the exact time).
- **About page:** a live year wheel with the solstices and equinoxes marked, the meaning of each month's name, the history behind the calendar, and its trade-offs.
- **Toolbar badge:** today's day of the month.
- **Themes:** match system, light or dark.

## Month names

Aurora · Flora · Verdis · Solara · Aestas · Calora · Messis · Vindemia · Brumis · Umbra · Glacia · Nivis · Renova

## Accuracy

Equinox and solstice times, and the times of new, first-quarter, full and last-quarter moons, come from Jean Meeus, *Astronomical Algorithms* (ch. 27 and 49), including the periodic correction terms. They match published times for 2024–2027 to within about a minute.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder.

## Files

| File | Purpose |
| --- | --- |
| `calendar-core.js` | Equinox, solstice and moon-phase math; fixed and lunar year layouts |
| `ui.js` | Shared settings, theme and month-grid rendering |
| `popup.*` | Toolbar popup |
| `calendar.*` | Full-year view |
| `about.*` | Explanation page with the year wheel |
| `background.js` | Badge updater |
