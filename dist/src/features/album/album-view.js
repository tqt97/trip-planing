const STATUS_LABELS = { reference: '📌 Tham khảo', want: '⭐ Muốn đi', visited: '✓ Đã đi' };

export function renderAlbum(els, rawItems = [], filter = 'all') {
  const items = [...rawItems]
    .filter((item) => filter === 'all' || item.status === filter)
    .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  if (els.albumCount) els.albumCount.textContent = `${rawItems.length} mục`;
  if (els.albumVisibleCount) els.albumVisibleCount.textContent = filter === 'all' ? 'Tất cả album' : STATUS_LABELS[filter] || filter;
  els.albumEmpty.hidden = items.length > 0;
  els.albumList.replaceChildren(...items.map(albumCard));
}

export function fillAlbumLightbox(els, item) {
  els.albumLightboxTitle.textContent = item.title || 'Trip Album';
  els.albumLightboxStatus.textContent = STATUS_LABELS[item.status] || item.status;
  els.albumLightboxNote.textContent = item.note || '';
  els.albumLightboxNote.hidden = !item.note;
  els.albumLightboxLink.href = item.noteUrl || '#';
  els.albumLightboxLink.hidden = !item.noteUrl;
  els.albumLightboxImage.src = item.imageUrl || '';
  els.albumLightboxImage.alt = item.title || 'Ảnh album chuyến đi';
  els.albumLightboxImage.hidden = !item.imageUrl;
  els.albumLightboxPlaceholder.hidden = Boolean(item.imageUrl);
}

function albumCard(item) {
  const article = document.createElement('article');
  article.className = `album-card status-${item.status}`;
  article.dataset.albumId = item.id;

  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'album-open';
  open.dataset.albumAction = 'view';
  open.setAttribute('aria-label', `Xem ${item.title}`);

  const media = document.createElement('div'); media.className = 'album-media';
  if (item.imageUrl) {
    const img = document.createElement('img'); img.loading = 'lazy'; img.decoding = 'async'; img.src = item.imageUrl; img.alt = item.title || 'Ảnh album'; media.append(img);
  } else {
    const placeholder = document.createElement('div'); placeholder.className = 'album-note-placeholder'; placeholder.textContent = item.noteUrl ? '🔗' : '📝'; media.append(placeholder);
  }
  const status = document.createElement('span'); status.className = 'album-status'; status.textContent = STATUS_LABELS[item.status] || item.status; media.append(status);

  const copy = document.createElement('div'); copy.className = 'album-copy';
  const h = document.createElement('h3'); h.textContent = item.title;
  const note = document.createElement('p'); note.textContent = item.note || (item.noteUrl ? 'Có link tham khảo' : 'Ảnh chuyến đi');
  copy.append(h, note);
  open.append(media, copy);

  const actions = document.createElement('div'); actions.className = 'album-actions';
  actions.append(action('✎','Sửa','edit'), action('×','Xóa','delete','danger'));
  article.append(open, actions);
  return article;
}

function action(text, label, actionName, extra='') {
  const button = document.createElement('button');
  button.type = 'button'; button.className = `icon-btn ${extra}`.trim(); button.dataset.albumAction = actionName; button.textContent = text; button.title = label; button.setAttribute('aria-label', label); return button;
}
