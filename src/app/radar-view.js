import { buildRadarPoints, filterRadarPlaces, resolveRadarRadiusKm } from '../core.js';
import { formatDistance, formatRadarRadius, radarCategoryLabel, truncateLabel, validCoords } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
const make = (tag, attrs = {}, text = '') => {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  if (text) node.textContent = text;
  return node;
};

export function renderRadarView({ els, state }) {
  if (!els.radarSvg || !els.radarSummary || !els.radarEmpty) return;
  const requestedRadiusKm = Number(els.radarRadius?.value || 5);
  const category = els.radarCategory?.value || 'all';
  const radarPlaces = filterRadarPlaces(state.places, state.home, { category, radiusKm: requestedRadiusKm });
  const radiusKm = resolveRadarRadiusKm(radarPlaces, requestedRadiusKm, state.home);
  const visible = buildRadarPoints(state.home, radarPlaces, radiusKm).filter((point) => !point.isOutside);

  els.radarSvg.replaceChildren();
  els.radarEmpty.hidden = validCoords(state.home) && visible.length > 0;
  els.radarEmpty.textContent = validCoords(state.home) ? 'Không có địa điểm phù hợp với bộ lọc radar.' : 'Cần Home có tọa độ để hiển thị radar.';
  els.radarSvg.hidden = !validCoords(state.home) || visible.length === 0;
  els.radarSummary.textContent = validCoords(state.home)
    ? `${visible.length} địa điểm · ${radarCategoryLabel(category)} · bán kính ${formatRadarRadius(radiusKm)} · đường chim bay từ Home`
    : 'Cần Home có tọa độ để hiển thị radar.';
  if (!validCoords(state.home) || !visible.length) return;

  const size = 520;
  const center = 260;
  const maxR = 205;
  els.radarSvg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  els.radarSvg.setAttribute('role', 'img');
  els.radarSvg.setAttribute('aria-label', `Radar vị trí ${visible.length} địa điểm quanh Home trong bán kính ${formatRadarRadius(radiusKm)}`);

  [0.25, 0.5, 0.75, 1].forEach((ratio, index) => {
    els.radarSvg.append(make('circle', { cx: center, cy: center, r: maxR * ratio, class: `radar-ring ring-${index + 1}` }));
    els.radarSvg.append(make('text', { x: center + 7, y: center - maxR * ratio + 15, class: 'radar-ring-label' }, formatRadarRadius(radiusKm * ratio)));
  });
  const spokes = [0,45,90,135];
  spokes.forEach((angle) => {
    const r = angle * Math.PI / 180;
    const dx = Math.cos(r) * maxR;
    const dy = Math.sin(r) * maxR;
    els.radarSvg.append(make('line', { x1: center-dx, y1: center-dy, x2: center+dx, y2: center+dy, class: 'radar-axis' }));
  });
  els.radarSvg.append(make('circle', { cx:center, cy:center, r:maxR*0.92, class:'radar-sweep' }));
  [['B', center, 29], ['Đ', 493, center + 5], ['N', center, 505], ['T', 27, center + 5]].forEach(([label, x, y]) => {
    els.radarSvg.append(make('text', { x, y, class: 'radar-cardinal', 'text-anchor': 'middle' }, label));
  });

  const home = make('g', { class: 'radar-home' });
  home.append(make('circle', { cx: center, cy: center, r: 15, class: 'radar-home-halo' }));
  home.append(make('circle', { cx: center, cy: center, r: 7, class: 'radar-home-dot' }));
  els.radarSvg.append(home);

  const compact = window.matchMedia?.('(max-width: 820px)').matches ?? false;
  const labelLimit = compact ? 24 : 14;
  const labelLength = compact ? 11 : 20;
  visible.slice(0, 80).forEach((point) => {
    const x = center + point.x * maxR;
    const y = center + point.y * maxR;
    const group = make('g', {
      class: `radar-place priority-${point.priority}`,
      tabindex: '0', role: 'link', 'data-radar-map': '1', 'data-lat': point.lat, 'data-lng': point.lng,
      'aria-label': `Mở ${point.name} trên Google Maps · ${point.direction}, ${formatDistance(point.distanceMeters)} đường chim bay`
    });
    group.append(make('circle', { cx: x, cy: y, r: point.priority === 'must' ? 7 : 5.5, class: 'radar-place-dot' }));
    group.append(make('title', {}, `${point.name} · ${point.direction} · ${formatDistance(point.distanceMeters)} · mở Google Maps`));
    if (visible.length <= labelLimit) {
      const rightSide = x >= center;
      group.append(make('text', {
        x: x + (rightSide ? (compact ? 7 : 10) : (compact ? -7 : -10)),
        y: y - (compact ? 6 : 8),
        class: 'radar-place-label',
        'text-anchor': rightSide ? 'start' : 'end'
      }, truncateLabel(point.name, labelLength)));
    }
    els.radarSvg.append(group);
  });
}
