export function renderMemberList(list, members, { currentUserId, role } = {}) {
  list.replaceChildren(...members.map(member => {
    const row = document.createElement('article'); row.className = 'member-row';
    const copy = document.createElement('div'); copy.className = 'member-copy';
    const strong = document.createElement('strong'); strong.textContent = member.profile?.full_name || member.profile?.email || 'Thành viên';
    const span = document.createElement('span'); span.textContent = member.profile?.email || member.user_id; copy.append(strong, span);
    const select = document.createElement('select'); select.className = 'member-role'; select.dataset.memberId = member.user_id;
    ['owner', 'editor', 'viewer'].forEach(value => { const o = document.createElement('option'); o.value = value; o.textContent = value; o.selected = member.role === value; select.append(o); });
    select.disabled = role !== 'owner' || member.user_id === currentUserId; row.append(copy, select); return row;
  }));
}
