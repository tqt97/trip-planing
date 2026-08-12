import { averageExpensePerPerson, paginateItems, totalExpenses } from '../../core.js';
import { expenseCategoryIcon, expenseCategoryLabel, formatMoney } from '../../app/ui.js';
import { renderCompactPagination } from '../common/pagination-view.js';
import { renderSettlement } from './settlement.js';

export function renderExpenses(els, rawExpenses = [], peopleCount = 1, requestedPage = 1, pageSize = 8) {
  const expenses = [...rawExpenses].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  els.expenseTotal.textContent = formatMoney(totalExpenses(expenses));
  els.expenseCount.textContent = `${expenses.length} khoản`;
  if (els.expenseAverage) els.expenseAverage.textContent = formatMoney(averageExpensePerPerson(expenses, peopleCount));
  if (els.peopleCount && document.activeElement !== els.peopleCount) els.peopleCount.value = String(Math.max(1, Number(peopleCount) || 1));
  if (els.settlementList) renderSettlement(els.settlementList, expenses);
  const page = paginateItems(expenses, requestedPage, pageSize);
  els.expenseEmpty.hidden = expenses.length > 0;
  els.expenseList.replaceChildren(...page.items.map(expenseRow));
  renderCompactPagination({ pagination: els.expensePagination, pageNumbers: els.expensePageNumbers, pageSummary: els.expensePageSummary, prevButton: els.expensePrevPageBtn, nextButton: els.expenseNextPageBtn }, page);
  return page;
}

function expenseRow(expense) {
  const row = document.createElement('article'); row.className = 'expense-row'; row.dataset.expenseId = expense.id;
  const main = document.createElement('div'); main.className = 'expense-main';
  const h = document.createElement('h3'); h.textContent = `${expenseCategoryIcon(expense.category)} ${expenseCategoryLabel(expense.category)}`;
  const meta = document.createElement('p'); meta.textContent = `${expense.payer} · ${new Date(expense.createdAt).toLocaleDateString('vi-VN')}`;
  const split = document.createElement('p'); split.className='expense-split'; split.textContent = expense.participants?.length ? `Chia: ${expense.participants.join(', ')}` : 'Chưa chọn người chia';
  main.append(h,meta,split); if (expense.note) { const note = document.createElement('p'); note.className = 'expense-note'; note.textContent = expense.note; main.append(note); }
  const amount = document.createElement('strong'); amount.className = 'expense-amount'; amount.textContent = formatMoney(expense.amountVnd);
  const actions = document.createElement('div'); actions.className = 'expense-actions'; actions.append(actionButton('✎', 'Sửa khoản chi', 'edit'), actionButton('×', 'Xóa khoản chi', 'delete', 'danger'));
  row.append(main, amount, actions); return row;
}
function actionButton(text, label, action, extra = '') { const b = document.createElement('button'); b.type = 'button'; b.className = `icon-btn ${extra}`.trim(); b.textContent = text; b.title = label; b.setAttribute('aria-label', label); b.dataset.expenseAction = action; return b; }
