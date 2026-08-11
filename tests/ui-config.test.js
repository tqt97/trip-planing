import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_UI_CONFIG, normalizeUiConfig } from '../src/config/ui-config.js';

test('UI config normalizes supported page/filter defaults and rejects unsafe values', () => {
  const ui = normalizeUiConfig({
    title: '  Trip riêng  ', subtitle: 'Sub', eyebrow: 'Eyebrow', defaultPageSize: 12,
    defaultRadiusKm: 10, defaultCategory: 'cafe', defaultSort: 'recommended',
    defaultRadarRadiusKm: 3, defaultRadarCategory: 'food'
  });
  assert.equal(ui.title, 'Trip riêng');
  assert.equal(ui.defaultPageSize, 12);
  assert.equal(ui.defaultRadiusKm, 10);
  assert.equal(ui.defaultCategory, 'cafe');
  assert.equal(ui.defaultSort, 'recommended');
  assert.equal(ui.defaultRadarRadiusKm, 3);
  assert.equal(ui.defaultRadarCategory, 'food');

  const fallback = normalizeUiConfig({ defaultPageSize: 999, defaultRadiusKm: 7, defaultCategory: 'bad', defaultSort: 'bad' });
  assert.equal(fallback.defaultPageSize, DEFAULT_UI_CONFIG.defaultPageSize);
  assert.equal(fallback.defaultRadiusKm, DEFAULT_UI_CONFIG.defaultRadiusKm);
  assert.equal(fallback.defaultCategory, DEFAULT_UI_CONFIG.defaultCategory);
  assert.equal(fallback.defaultSort, DEFAULT_UI_CONFIG.defaultSort);
});
