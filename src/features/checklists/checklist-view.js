export function renderChecklists(els, rawItems = [], currentUserId = null, members = []) {
  const items=[...rawItems].sort((a,b)=>Number(a.done)-Number(b.done)||new Date(b.updatedAt)-new Date(a.updatedAt));
  const done=items.filter(i=>i.done).length;
  if(els.checklistCount)els.checklistCount.textContent=`${items.length} mục`;
  if(els.checklistDoneCount)els.checklistDoneCount.textContent=`${done}/${items.length} hoàn thành`;
  els.checklistEmpty.hidden=items.length>0;
  const memberMap=new Map(members.map(m=>[m.user_id,m.profile||{}]));
  els.checklistList.replaceChildren(...items.map(item=>row(item,currentUserId,memberMap)));
}
function row(item,currentUserId,memberMap){
  const article=document.createElement('article');article.className=`checklist-row${item.done?' done':''}`;article.dataset.checklistId=item.id;
  const toggle=document.createElement('button');toggle.type='button';toggle.className='check-toggle';toggle.dataset.checkAction='toggle';toggle.setAttribute('aria-label',item.done?'Đánh dấu chưa xong':'Đánh dấu hoàn thành');toggle.textContent=item.done?'✓':'○';
  const main=document.createElement('div');main.className='check-main';const title=document.createElement('h3');title.textContent=item.title;
  const meta=document.createElement('p');meta.textContent=`${item.category==='prepare'?'🎒 Chuẩn bị':'🧭 Trong chuyến'} · ${item.visibility==='private'?'🔒 Riêng tư':'👥 Công khai'}`;main.append(title,meta);
  if(item.note){const note=document.createElement('p');note.className='check-note';note.textContent=item.note;main.append(note)}
  if(item.done&&item.completedBy){const who=memberMap.get(item.completedBy)||{};const email=String(who.email||'').trim();const label=email||String(who.full_name||'').trim()||(item.completedBy===currentUserId?'Bạn':'Thành viên');const avatar=document.createElement('span');avatar.className='check-completer';avatar.textContent=(email[0]||label[0]||'?').toUpperCase();avatar.title=`Đã hoàn thành bởi ${label}`;avatar.setAttribute('aria-label',`Đã hoàn thành bởi ${label}`);main.append(avatar)}
  const actions=document.createElement('div');actions.className='check-actions';actions.append(btn('✎','Sửa','edit'),btn('×','Xóa','delete','danger'));article.append(toggle,main,actions);return article;
}
function btn(text,label,action,extra=''){const b=document.createElement('button');b.type='button';b.className=`icon-btn ${extra}`.trim();b.dataset.checkAction=action;b.textContent=text;b.title=label;b.setAttribute('aria-label',label);return b}
