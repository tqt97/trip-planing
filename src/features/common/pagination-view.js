export function renderCompactPagination({ pagination, pageNumbers, pageSummary, prevButton, nextButton }, page) {
  if (!pagination || !pageNumbers || !pageSummary || !prevButton || !nextButton) return;
  const hasItems = page.totalItems > 0;
  const needsPagination = hasItems && page.totalPages > 1;
  pagination.hidden = !needsPagination;
  if (!needsPagination) { pageNumbers.replaceChildren(); pageSummary.textContent = ''; return; }
  prevButton.disabled = page.currentPage <= 1;
  nextButton.disabled = page.currentPage >= page.totalPages;
  pageNumbers.replaceChildren(...visiblePageNumbers(page.currentPage, page.totalPages).map(number => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `page-number${number === page.currentPage ? ' active' : ''}`;
    button.textContent = String(number);
    button.dataset.page = String(number);
    button.setAttribute('aria-label', `Trang ${number}`);
    if (number === page.currentPage) button.setAttribute('aria-current', 'page');
    return button;
  }));
  const from = page.totalItems ? page.startIndex + 1 : 0;
  pageSummary.textContent = `${from}–${page.endIndex} / ${page.totalItems}`;
}
function visiblePageNumbers(current, total) {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: 5 }, (_, i) => start + i);
}
