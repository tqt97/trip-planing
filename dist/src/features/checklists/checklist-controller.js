import { sanitizeChecklist, validateChecklist } from '../../core.js';
import { setBusy } from '../../app/ui.js';
import { renderChecklists } from './checklist-view.js';

export function createChecklistController({ els, state, getRepository, getCurrentUser, getMembers, persistState, toast, trace, errorDetails }) {
  const currentUserId = () => getCurrentUser()?.id || 'local';
  const canEdit = (item) => {
    const repo = getRepository();
    return !repo || item.visibility === 'public' || item.createdBy === currentUserId();
  };
  function render() { renderChecklists(els, state.checklists || [], currentUserId(), getMembers?.() || []); }
  function open(item = null) {
    els.checklistForm.reset(); els.checklistMessage.textContent = ''; els.checklistId.value = item?.id || '';
    els.checklistDialogTitle.textContent = item ? 'Sửa checklist' : 'Thêm mục checklist';
    if (item) { els.checklistTitle.value = item.title; els.checklistCategory.value = item.category; els.checklistVisibility.value = item.visibility; els.checklistNote.value = item.note || ''; }
    els.checklistDialog.showModal(); setTimeout(() => els.checklistTitle.focus(), 50);
  }
  async function save(event) {
    event.preventDefault(); els.checklistMessage.textContent = '';
    const repo = getRepository(); const existing = state.checklists.find(x => x.id === els.checklistId.value);
    const input = sanitizeChecklist({ id: els.checklistId.value || (repo && crypto.randomUUID ? crypto.randomUUID() : undefined), title: els.checklistTitle.value, category: els.checklistCategory.value, visibility: els.checklistVisibility.value, note: els.checklistNote.value, done: existing?.done || false, createdBy: existing?.createdBy || currentUserId(), createdAt: existing?.createdAt });
    const errors = validateChecklist(input); if (errors.length) { els.checklistMessage.textContent = errors[0]; return; }
    if (existing && !canEdit(existing)) { els.checklistMessage.textContent = 'Bạn không có quyền sửa checklist private của người khác.'; return; }
    setBusy(els.saveChecklistBtn, true, 'Đang lưu…');
    try {
      const saved = repo ? await repo.saveChecklist(input) : input;
      const idx = state.checklists.findIndex(x => x.id === saved.id); if (idx >= 0) state.checklists[idx] = saved; else state.checklists.push(saved);
      persistState(state); render(); els.checklistDialog.close(); toast('Đã lưu checklist.');
    } catch (error) {
      const id = trace('error', 'CHECKLIST_SAVE_FAILED', error.message, errorDetails(error)); els.checklistMessage.textContent = `Không lưu được checklist: ${error.message} · Trace ${id}`;
    } finally { setBusy(els.saveChecklistBtn, false, 'Lưu checklist'); }
  }
  async function action(event) {
    const btn = event.target.closest('[data-check-action]'); if (!btn) return;
    const row = btn.closest('[data-checklist-id]'); const item = state.checklists.find(x => x.id === row?.dataset.checklistId); if (!item) return;
    if (!canEdit(item)) return toast('Checklist private này chỉ chủ sở hữu được sửa.');
    if (btn.dataset.checkAction === 'edit') return open(item);
    const repo = getRepository();
    if (btn.dataset.checkAction === 'toggle') {
      const nextDone=!item.done; const updated = sanitizeChecklist({ ...item, done: nextDone, completedBy: nextDone ? currentUserId() : '', completedAt: nextDone ? new Date().toISOString() : null });
      try { const saved = repo ? await repo.saveChecklist(updated) : updated; state.checklists[state.checklists.findIndex(x => x.id === item.id)] = saved; persistState(state); render(); } catch (error) { toast(`Không cập nhật checklist: ${error.message}`); }
      return;
    }
    if (btn.dataset.checkAction === 'delete' && confirm(`Xóa “${item.title}”?`)) {
      try { if (repo) await repo.deleteChecklist(item.id); state.checklists = state.checklists.filter(x => x.id !== item.id); persistState(state); render(); } catch (error) { toast(`Không xóa được checklist: ${error.message}`); }
    }
  }
  return { render, open, save, action, canEdit };
}
