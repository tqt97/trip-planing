import test from 'node:test';
import assert from 'node:assert/strict';
import { groupTimelineDays, pickActiveTimelineDate, timelineWindowDates } from '../src/features/timeline/timeline-view.js';

test('timeline groups by day and keeps morning-to-evening order', () => {
  const days = groupTimelineDays([
    { id:'c', date:'2026-08-15', time:'19:00' },
    { id:'a', date:'2026-08-15', time:'07:30' },
    { id:'b', date:'2026-08-15', time:'13:00' },
    { id:'d', date:'2026-08-16', time:'08:00' }
  ]);
  assert.deepEqual(days.map(day => day.date), ['2026-08-15','2026-08-16']);
  assert.deepEqual(days[0].items.map(item => item.time), ['07:30','13:00','19:00']);
});

test('timeline picks today, otherwise nearest upcoming day', () => {
  const dates = ['2026-08-10','2026-08-13','2026-08-15'];
  assert.equal(pickActiveTimelineDate(dates, new Date('2026-08-13T09:00:00')), '2026-08-13');
  assert.equal(pickActiveTimelineDate(dates, new Date('2026-08-12T09:00:00')), '2026-08-13');
  assert.equal(pickActiveTimelineDate(dates, new Date('2026-08-20T09:00:00')), '2026-08-15');
});

test('desktop timeline window keeps at most three dates around active day', () => {
  const dates = ['2026-08-10','2026-08-11','2026-08-12','2026-08-13','2026-08-14'];
  assert.deepEqual(timelineWindowDates(dates, '2026-08-12', 3), ['2026-08-11','2026-08-12','2026-08-13']);
  assert.deepEqual(timelineWindowDates(dates, '2026-08-10', 3), ['2026-08-10','2026-08-11','2026-08-12']);
  assert.deepEqual(timelineWindowDates(dates, '2026-08-14', 3), ['2026-08-12','2026-08-13','2026-08-14']);
});
