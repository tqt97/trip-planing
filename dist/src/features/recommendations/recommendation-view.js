import { groupNearby, recommendPlaces } from '../../core.js';
import { categoryIcon, formatDistance, formatDuration, priorityLabel, validCoords } from '../../app/ui.js';

export function renderRecommendations(container, places, votes, openMap) {
  const items = recommendPlaces(places, votes, 6);
  container.replaceChildren(...items.map((p, i) => {
    const el = document.createElement('article'); el.className = 'recommend-item';
    if (validCoords(p)) { el.classList.add('recommend-link'); el.tabIndex = 0; el.setAttribute('role', 'link'); el.setAttribute('aria-label', `Mở ${p.name} trên Google Maps`); el.addEventListener('click', () => openMap(p.lat, p.lng, p.name)); el.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMap(p.lat, p.lng, p.name); } }); }
    const rank = document.createElement('div'); rank.className = 'rank'; rank.textContent = `#${i + 1}`;
    const h = document.createElement('h3'); h.textContent = `${categoryIcon(p.category)} ${p.name}`;
    const vote = document.createElement('div'); vote.className = 'vote-meta'; vote.textContent = `♥ ${p.voteCount || 0} vote`;
    const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = `${formatDistance(p.distanceMeters)} · ${formatDuration(p.durationSeconds)} · ${priorityLabel(p.priority)}`;
    el.append(rank, h, vote, meta); return el;
  }));
  if (!items.length) { const p = document.createElement('p'); p.className = 'meta'; p.textContent = 'Thêm địa điểm có tọa độ để nhận gợi ý.'; container.replaceChildren(p); }
}

export function renderClusters(container, places, openMap) {
  const groups = groupNearby(places, 1800).filter(g => g.length > 1).slice(0, 6);
  container.replaceChildren(...groups.map((group, index) => {
    const card = document.createElement('article'); card.className = 'cluster';
    const head = document.createElement('div'); head.className = 'cluster-head'; const title = document.createElement('strong'); title.textContent = `Cụm ${index + 1}`; const count = document.createElement('span'); count.textContent = `${group.length} nơi`; head.append(title, count);
    const list = document.createElement('div'); list.className = 'cluster-places';
    group.slice(0, 6).forEach(place => { const item = document.createElement('button'); item.type = 'button'; item.className = 'cluster-place'; const icon = document.createElement('span'); icon.textContent = categoryIcon(place.category); const copy = document.createElement('span'); const name = document.createElement('b'); name.textContent = place.name; const meta = document.createElement('small'); meta.textContent = `${formatDistance(place.distanceMeters)} · ${formatDuration(place.durationSeconds)}`; copy.append(name, meta); item.append(icon, copy); if (validCoords(place)) item.addEventListener('click', () => openMap(place.lat, place.lng, place.name)); else item.disabled = true; list.append(item); });
    card.append(head, list); return card;
  }));
  if (!groups.length) { const p = document.createElement('p'); p.className = 'meta'; p.textContent = 'Chưa đủ địa điểm có tọa độ để gom cụm.'; container.replaceChildren(p); }
}
