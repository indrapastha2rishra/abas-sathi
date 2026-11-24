import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateDisplay,
  formatDateTimeDisplay,
  formatMonthYearDisplay,
  getMonthShortName,
} from './dateFormat.ts';

test('formatDateDisplay converts ISO YYYY-MM-DD and YYYY/MM/DD to dd-mmm-yyyy without timezone shift', () => {
  assert.equal(formatDateDisplay('2026-04-01'), '01-Apr-2026');
  assert.equal(formatDateDisplay('2026-09-05'), '05-Sep-2026');
  assert.equal(formatDateDisplay('2026/11/24'), '24-Nov-2026');
  assert.equal(formatDateDisplay('2026-4-3'), '03-Apr-2026');
});

test('formatDateDisplay converts DD/MM/YYYY and DD-MM-YYYY to dd-mmm-yyyy', () => {
  assert.equal(formatDateDisplay('01/04/2026'), '01-Apr-2026');
  assert.equal(formatDateDisplay('5-9-2026'), '05-Sep-2026');
});

test('formatDateDisplay normalizes already formatted dates including Sept to Sep', () => {
  assert.equal(formatDateDisplay('5-Sept-2026'), '05-Sep-2026');
  assert.equal(formatDateDisplay('12 Sep 2026'), '12-Sep-2026');
  assert.equal(formatDateDisplay('24-Nov-2026'), '24-Nov-2026');
});

test('formatDateDisplay handles Date objects and UTC ISO timestamps cleanly', () => {
  const localDate = new Date(2026, 8, 15, 10, 30, 0);
  assert.equal(formatDateDisplay(localDate), '15-Sep-2026');

  const utcStamp = '2026-04-15T12:00:00.000Z';
  const expected = new Date(utcStamp);
  const expectedStr = `${String(expected.getDate()).padStart(2, '0')}-${getMonthShortName(expected.getMonth())}-${expected.getFullYear()}`;
  assert.equal(formatDateDisplay(utcStamp), expectedStr);
});

test('formatDateDisplay returns fallbacks and preserves non-date labels safely', () => {
  assert.equal(formatDateDisplay('', '—'), '—');
  assert.equal(formatDateDisplay(null, '—'), '—');
  assert.equal(formatDateDisplay(undefined, 'Current'), 'Current');
  assert.equal(formatDateDisplay('Ongoing'), 'Ongoing');
  assert.equal(formatDateDisplay('None Pending'), 'None Pending');
});

test('formatDateTimeDisplay preserves time while formatting date as dd-mmm-yyyy', () => {
  assert.equal(formatDateTimeDisplay('2026-04-01 10:15:00'), '01-Apr-2026 10:15:00');
  assert.equal(formatDateTimeDisplay('', '—'), '—');
});

test('formatMonthYearDisplay formats YYYY-MM into Mmm-YYYY', () => {
  assert.equal(formatMonthYearDisplay('2026-04'), 'Apr-2026');
  assert.equal(formatMonthYearDisplay('2026-09'), 'Sep-2026');
});
