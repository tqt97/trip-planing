export function renderChecklists(els, rawItems = [], completions = [], currentUserId = null, members = []) {
  const completionMap = new Map();
  for (const completion of completions) {
    if (!completion?.checklistId || !completion?.userId) continue;
    if (!completionMap.has(completion.checklistId)) completionMap.set(completion.checklistId, []);
    completionMap.get(completion.checklistId).push(completion);
  }
  const isMineDone = (item) => (completionMap.get(item.id) || []).some(x => x.userId === currentUserId);
  const items=[...rawItems].sort((a,b)=>Number(isMineDone(a))-Number(isMineDone(b))||new Date(b.updatedAt)-new Date(a.updatedAt));
  const done=items.filter(isMineDone).length;
  if(els.checklistCount)els.checklistCount.textContent=`${items.length} mục`;
  if(els.checklistDoneCount)els.checklistDoneCount.textContent=`${done}/${items.length} bạn đã xong`;
  els.checklistEmpty.hidden=items.length>0;
  const memberMap=new Map(members.map(m=>[m.user_id,m.profile||{}]));
  els.checklistList.replaceChildren(...items.map(item=>row(item,completionMap.get(item.id)||[],currentUserId,memberMap)));
}
function row(item,completions,currentUserId,memberMap){
  const mineDone=completions.some(x=>x.userId===currentUserId);
  const article=document.createElement('article');article.className=`checklist-row${mineDone?' done':''}`;article.dataset.checklistId=item.id;
  const toggle=document.createElement('button');toggle.type='button';toggle.className='check-toggle';toggle.dataset.checkAction='toggle';toggle.setAttribute('aria-label',mineDone?'Bỏ đánh dấu hoàn thành của bạn':'Đánh dấu bạn đã hoàn thành');toggle.textContent=mineDone?'✓':'○';
  const main=document.createElement('div');main.className='check-main';const title=document.createElement('h3');title.textContent=item.title;
  const meta=document.createElement('p');meta.textContent=`${item.category==='prepare'?'🎒 Chuẩn bị':'🧭 Trong chuyến'} · ${item.visibility==='private'?'🔒 Riêng tư':'👥 Công khai'}`;main.append(title,meta);
  if(item.note){const note=document.createElement('p');note.className='check-note';note.textContent=item.note;main.append(note)}
  if(completions.length){const group=document.createElement('div');group.className='check-completers';group.setAttribute('aria-label',`${completions.length} người đã hoàn thành`);for(const completion of completions){const who=memberMap.get(completion.userId)||{};const email=String(who.email||'').trim();const label=email||String(who.full_name||'').trim()||(completion.userId===currentUserId?'Bạn':'Thành viên');const avatar=document.createElement('span');avatar.className='check-completer';avatar.textContent=(email[0]||label[0]||'?').toUpperCase();avatar.title=`${label} đã hoàn thành`;avatar.setAttribute('aria-label',`${label} đã hoàn thành`);group.append(avatar)}main.append(group)}
  const actions=document.createElement('div');actions.className='check-actions';actions.append(btn('✎','Sửa','edit'),btn('×','Xóa','delete','danger'));article.append(toggle,main,actions);return article;
}
function btn(text,label,action,extra=''){const b=document.createElement('button');b.type='button';b.className=`icon-btn ${extra}`.trim();b.dataset.checkAction=action;b.textContent=text;b.title=label;b.setAttribute('aria-label',label);return b}
