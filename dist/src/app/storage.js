import { exportState, importState, sanitizeHome } from '../core.js';

export const STORAGE_KEY = 'dalat-nearby-planner:v3';
export const TRACE_KEY = 'dalat-nearby-planner:traces:v1';
export const UI_PREFS_KEY = 'dalat-nearby-planner:ui:v1';
export const MAX_TRACES = 80;

export function normalizePageSize(value) {
  const allowed = [4, 6, 8, 10, 12, 20];
  const n = Number(value);
  return allowed.includes(n) ? n : 8;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
      || localStorage.getItem('dalat-nearby-planner:v2')
      || localStorage.getItem('dalat-nearby-planner:v1');
    if (!raw) return { home: sanitizeHome({}), places: [], expenses: [] };
    return importState(raw);
  } catch {
    return { home: sanitizeHome({}), places: [], expenses: [] };
  }
}

export function persistState(state) {
  localStorage.setItem(STORAGE_KEY, exportState(state));
}

export function loadUiPrefs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(UI_PREFS_KEY) || '{}');
    return { pageSize: normalizePageSize(parsed.pageSize) };
  } catch {
    return { pageSize: 8 };
  }
}

export function saveUiPrefs(uiPrefs) {
  try { localStorage.setItem(UI_PREFS_KEY, JSON.stringify(uiPrefs)); } catch {}
}

export function loadTraces() {
  try { return JSON.parse(localStorage.getItem(TRACE_KEY) || '[]'); } catch { return []; }
}

export function saveTraces(traces) {
  try { localStorage.setItem(TRACE_KEY, JSON.stringify(traces.slice(-MAX_TRACES))); } catch {}
}
