import { hasUserVoted } from '../../core.js';
import { categoryIcon, formatDistance, formatDuration, priorityLabel } from '../../app/ui.js';

export function createPlaceRow(place, { currentUserId, votes = [] } = {}) {
  const row = document.createElement('article'); row.className = 'place-row'; row.dataset.id = place.id;
  const main = document.createElement('div'); main.className = 'place-main';
  const h = document.createElement('h3'); h.textContent = `${categoryIcon(place.category)} ${place.name}`;
  const p = document.createElement('p'); p.textContent = `${priorityLabel(place.priority)} · ${place.address || `${place.lat?.toFixed(5)}, ${place.lng?.toFixed(5)}`}`;
  const meta = document.createElement('div'); meta.className = 'route-meta';
  const source = document.createElement('span'); source.className = `route-pill ${place.routeSource === 'ors' ? 'real' : 'fallback'}`; source.textContent = place.routeSource === 'ors' ? '✓ Route ORS' : '≈ ETA Đà Lạt';
  const eta = document.createElement('span'); eta.className = 'route-pill'; eta.textContent = formatDuration(place.durationSeconds);
  const voteBtn = document.createElement('button'); voteBtn.type = 'button'; voteBtn.className = `vote-btn${hasUserVoted(place.id, currentUserId, votes) ? ' voted' : ''}`; voteBtn.dataset.action = 'vote'; voteBtn.textContent = `♥ ${votes.filter(v => v.place_id === place.id).length}`; voteBtn.title = 'Vote địa điểm'; voteBtn.disabled = !currentUserId;
  meta.append(source, eta, voteBtn); main.append(h, p, meta);
  const distance = document.createElement('div'); distance.className = 'distance';
  const strong = document.createElement('strong'); strong.textContent = formatDistance(place.distanceMeters);
  const span = document.createElement('span'); span.textContent = 'từ Home'; distance.append(strong, span);
  const actions = document.createElement('div'); actions.className = 'row-actions'; actions.append(actionButton('G', 'Mở Google Maps', 'map', 'map-google'), actionButton('✎', 'Sửa', 'edit'), actionButton('↻', 'Tính lại', 'refresh'), actionButton('×', 'Xóa', 'delete', 'danger'));
  row.append(main, distance, actions); return row;
}

export function renderPagination(els, page) {
  const hasItems = page.totalItems > 0;
  els.pagination.hidden = !hasItems;
  if (!hasItems) { els.pageNumbers.replaceChildren(); els.pageSummary.textContent = ''; return; }
  els.prevPageBtn.disabled = page.currentPage <= 1;
  els.nextPageBtn.disabled = page.currentPage >= page.totalPages;
  els.pageNumbers.replaceChildren(...visiblePageNumbers(page.currentPage, page.totalPages).map(number => {
    const button = document.createElement('button'); button.type = 'button'; button.className = `page-number${number === page.currentPage ? ' active' : ''}`; button.textContent = String(number); button.dataset.page = String(number); button.setAttribute('aria-label', `Trang ${number}`); if (number === page.currentPage) button.setAttribute('aria-current', 'page'); return button;
  }));
  const from = page.totalItems ? page.startIndex + 1 : 0;
  els.pageSummary.textContent = `${from}–${page.endIndex} / ${page.totalItems} · Trang ${page.currentPage}/${page.totalPages}`;
}

function visiblePageNumbers(current, total) { if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1); const start = Math.max(1, Math.min(current - 2, total - 4)); return Array.from({ length: 5 }, (_, i) => start + i); }
function actionButton(text, label, action, extra = '') { const b = document.createElement('button'); b.type = 'button'; b.className = `icon-btn ${extra}`.trim(); b.textContent = text; b.title = label; b.setAttribute('aria-label', label); b.dataset.action = action; return b; }
