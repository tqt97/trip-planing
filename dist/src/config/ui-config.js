const PAGE_SIZES = [4, 6, 8, 10, 12, 20];
const RADII = [1, 3, 5, 10, 9999];
const CATEGORIES = ['all', 'food', 'cafe', 'attraction', 'shopping', 'other'];
const SORTS = ['distance', 'recommended', 'name'];

export const DEFAULT_UI_CONFIG = Object.freeze({
  eyebrow: 'ĐÀ LẠT · TRIP COMPANION',
  title: 'Ní ơi, mình đi đâu thế.',
  subtitle: 'Lên danh sách, xem khoảng cách và chọn nơi đáng đi ngay lúc này.',
  defaultPageSize: 8,
  defaultRadiusKm: 5,
  defaultCategory: 'all',
  defaultSort: 'distance',
  defaultRadarRadiusKm: 5,
  defaultRadarCategory: 'all'
});

export function normalizeUiConfig(input = {}) {
  return {
    eyebrow: cleanText(input.eyebrow, DEFAULT_UI_CONFIG.eyebrow, 80),
    title: cleanText(input.title, DEFAULT_UI_CONFIG.title, 100),
    subtitle: cleanText(input.subtitle, DEFAULT_UI_CONFIG.subtitle, 180),
    defaultPageSize: pickNumber(input.defaultPageSize, PAGE_SIZES, DEFAULT_UI_CONFIG.defaultPageSize),
    defaultRadiusKm: pickNumber(input.defaultRadiusKm, RADII, DEFAULT_UI_CONFIG.defaultRadiusKm),
    defaultCategory: pickString(input.defaultCategory, CATEGORIES, DEFAULT_UI_CONFIG.defaultCategory),
    defaultSort: pickString(input.defaultSort, SORTS, DEFAULT_UI_CONFIG.defaultSort),
    defaultRadarRadiusKm: pickNumber(input.defaultRadarRadiusKm, RADII, DEFAULT_UI_CONFIG.defaultRadarRadiusKm),
    defaultRadarCategory: pickString(input.defaultRadarCategory, CATEGORIES, DEFAULT_UI_CONFIG.defaultRadarCategory)
  };
}

export function applyUiConfig(config, root = document) {
  const ui = normalizeUiConfig(config);
  setText(root, '#appEyebrow', ui.eyebrow);
  setText(root, '#appTitle', ui.title);
  setText(root, '#appSubtitle', ui.subtitle);
  document.title = `${ui.title} · Đà Lạt Trip Planner`;
  return ui;
}

function setText(root, selector, value) { const el = root.querySelector(selector); if (el) el.textContent = value; }
function cleanText(value, fallback, max) { const text = String(value ?? '').trim(); return (text || fallback).slice(0, max); }
function pickNumber(value, allowed, fallback) { const n = Number(value); return allowed.includes(n) ? n : fallback; }
function pickString(value, allowed, fallback) { const text = String(value ?? '').trim(); return allowed.includes(text) ? text : fallback; }
