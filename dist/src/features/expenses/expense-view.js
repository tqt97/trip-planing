import { averageExpensePerPerson, totalExpenses } from '../../core.js';
import { expenseCategoryIcon, expenseCategoryLabel, formatMoney } from '../../app/ui.js';

export function renderExpenses(els, rawExpenses = [], peopleCount = 1) {
  const expenses = [...rawExpenses].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  els.expenseTotal.textContent = formatMoney(totalExpenses(expenses));
  els.expenseCount.textContent = `${expenses.length} khoản`;
  if (els.expenseAverage) els.expenseAverage.textContent = formatMoney(averageExpensePerPerson(expenses, peopleCount));
  if (els.peopleCount && document.activeElement !== els.peopleCount) els.peopleCount.value = String(Math.max(1, Number(peopleCount) || 1));
  els.expenseEmpty.hidden = expenses.length > 0;
  els.expenseList.replaceChildren(...expenses.map(expenseRow));
}

function expenseRow(expense) {
  const row = document.createElement('article'); row.className = 'expense-row'; row.dataset.expenseId = expense.id;
  const main = document.createElement('div'); main.className = 'expense-main';
  const h = document.createElement('h3'); h.textContent = `${expenseCategoryIcon(expense.category)} ${expenseCategoryLabel(expense.category)}`;
  const meta = document.createElement('p'); meta.textContent = `${expense.payer} · ${new Date(expense.createdAt).toLocaleDateString('vi-VN')}`;
  if (expense.note) { const note = document.createElement('p'); note.className = 'expense-note'; note.textContent = expense.note; main.append(h, meta, note); } else main.append(h, meta);
  const amount = document.createElement('strong'); amount.className = 'expense-amount'; amount.textContent = formatMoney(expense.amountVnd);
  const actions = document.createElement('div'); actions.className = 'expense-actions'; actions.append(actionButton('✎', 'Sửa khoản chi', 'edit'), actionButton('×', 'Xóa khoản chi', 'delete', 'danger'));
  row.append(main, amount, actions); return row;
}
function actionButton(text, label, action, extra = '') { const b = document.createElement('button'); b.type = 'button'; b.className = `icon-btn ${extra}`.trim(); b.textContent = text; b.title = label; b.setAttribute('aria-label', label); b.dataset.expenseAction = action; return b; }
