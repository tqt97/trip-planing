export const $ = (selector) => document.querySelector(selector);

export function collectElements() {
  return {
    homeTitle: $('#homeTitle'), homeMeta: $('#homeMeta'), homeMapBtn: $('#homeMapBtn'), statTotal: $('#statTotal'), statNearby: $('#statNearby'), statMust: $('#statMust'), statAvg: $('#statAvg'), recommendations: $('#recommendations'), placesList: $('#placesList'), emptyState: $('#emptyState'), resultCount: $('#resultCount'), clusters: $('#clusters'), radarSvg: $('#radarSvg'), radarEmpty: $('#radarEmpty'), radarSummary: $('#radarSummary'), radarRadius: $('#radarRadiusSelect'), radarCategory: $('#radarCategorySelect'),
    expenseList: $('#expenseList'), expenseTotal: $('#expenseTotal'), expenseCount: $('#expenseCount'), expenseAverage: $('#expenseAverage'), peopleCount: $('#peopleCount'), expenseEmpty: $('#expenseEmpty'), expenseDialog: $('#expenseDialog'), expenseForm: $('#expenseForm'), expenseId: $('#expenseId'), expensePayer: $('#expensePayer'), expenseCategory: $('#expenseCategory'), expenseAmount: $('#expenseAmount'), expenseNote: $('#expenseNote'), expenseMessage: $('#expenseMessage'), expenseDialogTitle: $('#expenseDialogTitle'), saveExpenseBtn: $('#saveExpenseBtn'), expensePagination: $('#expensePagination'), expensePageNumbers: $('#expensePageNumbers'), expensePageSummary: $('#expensePageSummary'), expensePrevPageBtn: $('#expensePrevPageBtn'), expenseNextPageBtn: $('#expenseNextPageBtn'), backToTop: $('#backToTop'),
    radius: $('#radiusSelect'), category: $('#categorySelect'), sort: $('#sortSelect'), search: $('#searchInput'), pageSize: $('#pageSizeSelect'), placeFilters: $('#placeFilters'), filterSummary: $('#filterSummary'), pagination: $('#pagination'), pageNumbers: $('#pageNumbers'), pageSummary: $('#pageSummary'), prevPageBtn: $('#prevPageBtn'), nextPageBtn: $('#nextPageBtn'),
    placeDialog: $('#placeDialog'), placeForm: $('#placeForm'), placeId: $('#placeId'), placeName: $('#placeName'), placeAddress: $('#placeAddress'), placeMapsUrl: $('#placeMapsUrl'), placeCategory: $('#placeCategory'), placePriority: $('#placePriority'), placeNote: $('#placeNote'), placeNoteUrl: $('#placeNoteUrl'), placeImage: $('#placeImage'), placeImagePreview: $('#placeImagePreview'), placeLat: $('#placeLat'), placeLng: $('#placeLng'), placeMessage: $('#placeMessage'), placeDialogTitle: $('#placeDialogTitle'), savePlaceBtn: $('#savePlaceBtn'),
    homeDialog: $('#homeDialog'), homeForm: $('#homeForm'), homeAddress: $('#homeAddress'), homeLat: $('#homeLat'), homeLng: $('#homeLng'), homeMessage: $('#homeMessage'), toast: $('#toast'),
    albumList: $('#albumList'), albumEmpty: $('#albumEmpty'), albumCount: $('#albumCount'), albumVisibleCount: $('#albumVisibleCount'), albumFilter: $('#albumFilter'), albumDialog: $('#albumDialog'), albumForm: $('#albumForm'), albumId: $('#albumId'), albumTitle: $('#albumTitle'), albumStatus: $('#albumStatus'), albumNote: $('#albumNote'), albumNoteUrl: $('#albumNoteUrl'), albumImage: $('#albumImage'), albumMessage: $('#albumMessage'), albumDialogTitle: $('#albumDialogTitle'), saveAlbumBtn: $('#saveAlbumBtn'), albumPagination: $('#albumPagination'), albumPageNumbers: $('#albumPageNumbers'), albumPageSummary: $('#albumPageSummary'), albumPrevPageBtn: $('#albumPrevPageBtn'), albumNextPageBtn: $('#albumNextPageBtn'), albumLightbox: $('#albumLightbox'), albumLightboxImage: $('#albumLightboxImage'), albumLightboxTitle: $('#albumLightboxTitle'), albumLightboxStatus: $('#albumLightboxStatus'), albumLightboxNote: $('#albumLightboxNote'), albumLightboxLink: $('#albumLightboxLink'),
    checklistList: $('#checklistList'), checklistEmpty: $('#checklistEmpty'), checklistDialog: $('#checklistDialog'), checklistForm: $('#checklistForm'), checklistId: $('#checklistId'), checklistTitle: $('#checklistTitle'), checklistCategory: $('#checklistCategory'), checklistVisibility: $('#checklistVisibility'), checklistNote: $('#checklistNote'), checklistMessage: $('#checklistMessage'), checklistDialogTitle: $('#checklistDialogTitle'), saveChecklistBtn: $('#saveChecklistBtn'), checklistCount: $('#checklistCount'), checklistDoneCount: $('#checklistDoneCount'), traceDialog: $('#traceDialog'), traceList: $('#traceList'), systemHealth: $('#systemHealth')
  };
}

export function validCoords(value) {
  return Boolean(value && Number.isFinite(value.lat) && Number.isFinite(value.lng));
}

export function sameCoords(a, b) {
  return validCoords(a) && validCoords(b) && a.lat === b.lat && a.lng === b.lng;
}

export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '—';
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'chưa tính';
  return `~${Math.max(1, Math.round(seconds / 60))} phút`;
}

export function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0);
}

export function formatRadarRadius(km) {
  if (!Number.isFinite(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
}

export function truncateLabel(value, max = 20) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export const categoryIcon = (c) => ({ food: '🍜', cafe: '☕', attraction: '🌲', shopping: '🛍', other: '📌' })[c] || '📌';
export const expenseCategoryIcon = (c) => ({ food: '🍜', cafe: '☕', transport: '🛵', attraction: '🎟', shopping: '🛍', stay: '🏡', other: '📌' })[c] || '📌';
export const expenseCategoryLabel = (c) => ({ food: 'Ăn uống', cafe: 'Cafe', transport: 'Di chuyển', attraction: 'Vé / vui chơi', shopping: 'Mua sắm', stay: 'Lưu trú', other: 'Khác' })[c] || 'Khác';
export const radarCategoryLabel = (c) => c === 'all' ? 'Tất cả danh mục' : ({ food: 'Ăn uống', cafe: 'Cafe', attraction: 'Vui chơi', shopping: 'Mua sắm', other: 'Khác' })[c] || 'Khác';
export const priorityLabel = (p) => p === 'must' ? '🔥 Must go' : p === 'want' ? '⭐ Muốn đi' : '💭 Có thể';
export const placeCategoryLabel = (c) => ({ all: 'Tất cả', food: 'Ăn', cafe: 'Cafe', attraction: 'Chơi', shopping: 'Mua', other: 'Khác' })[c] || 'Tất cả';

export function setBusy(element, busy, text) {
  element.disabled = busy;
  element.textContent = text;
}

export function createToast(element) {
  let timer;
  return (text) => {
    clearTimeout(timer);
    element.textContent = text;
    element.classList.add('show');
    timer = setTimeout(() => element.classList.remove('show'), 3800);
  };
}
