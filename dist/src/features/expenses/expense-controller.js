import { renderExpenses } from './expense-view.js';

export function createExpensePager({ els, state, pageSize = 8 }) {
  let currentPage = 1;
  function render() {
    const page = renderExpenses(els, state.expenses || [], state.tripSettings?.peopleCount || 4, currentPage, pageSize);
    currentPage = page.currentPage;
  }
  function reset() { currentPage = 1; render(); }
  function changePage(next) { currentPage = next; render(); }
  function bind() {
    els.expensePrevPageBtn?.addEventListener('click', () => changePage(currentPage - 1));
    els.expenseNextPageBtn?.addEventListener('click', () => changePage(currentPage + 1));
    els.expensePageNumbers?.addEventListener('click', (event) => { const button = event.target.closest('[data-page]'); if (button) changePage(Number(button.dataset.page)); });
  }
  return { bind, render, reset, changePage };
}
