import { calibrateDurationSeconds, estimateDurationSeconds, estimateRoadMeters, exportState, filterAndSortPlaces, groupNearby, googleMapsCoordinateUrl, haversineMeters, importState, paginateItems, parseGoogleMapsCoordinates, recommendPlaces, hasUserVoted, sanitizeExpense, sanitizeHome, sanitizePlace, totalExpenses, uid, validateExpense, validatePlace } from '/src/core.js';
import { SupabaseHttpClient } from '/src/data/supabase-client.js';
import { CollaborativeRepository } from '/src/data/repository.js';
import { loadState, loadTraces, loadUiPrefs, MAX_TRACES, normalizePageSize, persistState, saveTraces as persistTraces, saveUiPrefs as persistUiPrefs } from '/src/app/storage.js';
import { $, categoryIcon, collectElements, createToast, expenseCategoryIcon, expenseCategoryLabel, formatDistance, formatDuration, formatMoney, placeCategoryLabel, priorityLabel, sameCoords, setBusy, validCoords } from '/src/app/ui.js';
import { renderRadarView } from '/src/app/radar-view.js';
import { createDemoPlaces } from '/src/app/demo-seed.js';

const state = loadState();
const uiPrefs = loadUiPrefs();
let currentPage = 1;
let traces = loadTraces();
let routingConfigured = false;
let collaborationConfig = null;
let collaborationClient = null;
let repository = null;
let currentUser = null;
let votes = [];
let members = [];
let realtimeReloadTimer = null;
const els = collectElements();
const toast = createToast(els.toast);

await init();

async function init() {
  bind();
  els.pageSize.value = String(uiPrefs.pageSize);
  syncPlaceFiltersForViewport();
  trace('info', 'APP_BOOT', 'Ứng dụng khởi động.', { viewport: `${window.innerWidth}x${window.innerHeight}`, pageSize: uiPrefs.pageSize });
  await loadFixedHome();
  if (collaborationConfig?.configured) {
    const ready = await initCollaboration();
    if (!ready) return;
  } else {
    seedPlacesIfEmpty();
  }
  persistState(state);
  render();
}

function bind() {
  $('#googleLoginBtn')?.addEventListener('click', () => collaborationClient?.signInWithGoogle(`${location.origin}/`));
  $('#userBtn')?.addEventListener('click', signOutUser);
  $('#membersBtn')?.addEventListener('click', openMembersDialog);
  $('#mobileMembersBtn')?.addEventListener('click', openMembersDialog);
  $('#signOutBtn')?.addEventListener('click', signOutUser);
  $('#doneMembersBtn')?.addEventListener('click', () => $('#membersDialog')?.close());
  $('#closeMembersBtn')?.addEventListener('click', () => $('#membersDialog')?.close());
  $('#membersList')?.addEventListener('change', onMemberRoleChange);
  window.addEventListener('online', () => repository && reloadCollaborativeData('online').catch(error => trace('warn','ONLINE_SYNC_FAILED',error.message,errorDetails(error))));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && repository) reloadCollaborativeData('foreground').catch(error => trace('warn','FOREGROUND_SYNC_FAILED',error.message,errorDetails(error))); });
  $('#addBtn').addEventListener('click', () => openPlaceDialog());
  $('#mobileAddBtn').addEventListener('click', () => openPlaceDialog());
  $('#homeBtn').addEventListener('click', openHomeDialog);
  els.homeMapBtn?.addEventListener('click', () => { if (validCoords(state.home)) openGoogleMaps(state.home.lat, state.home.lng, state.home.address || 'Home'); else toast('Home chưa có tọa độ.'); });
  document.querySelectorAll('.close-dialog').forEach((b) => b.addEventListener('click', () => els.placeDialog.close()));
  document.querySelectorAll('.close-home').forEach((b) => b.addEventListener('click', () => els.homeDialog.close()));
  [els.radius, els.category, els.sort].forEach((el) => el.addEventListener('change', () => { currentPage = 1; render(); }));
  [els.radarRadius, els.radarCategory].forEach((el) => el.addEventListener('change', () => renderRadar()));
  els.search.addEventListener('input', () => { currentPage = 1; render(); });
  els.pageSize.addEventListener('change', () => { uiPrefs.pageSize = normalizePageSize(els.pageSize.value); persistUiPrefs(uiPrefs); currentPage = 1; render(); });
  els.prevPageBtn.addEventListener('click', () => changePage(currentPage - 1));
  els.nextPageBtn.addEventListener('click', () => changePage(currentPage + 1));
  els.pageNumbers.addEventListener('click', (event) => { const btn = event.target.closest('[data-page]'); if (btn) changePage(Number(btn.dataset.page)); });
  els.placeForm.addEventListener('submit', savePlace);
  els.homeForm.addEventListener('submit', (event) => { event.preventDefault(); els.homeDialog.close(); });
  els.placeMapsUrl.addEventListener('input', fillCoordsFromMapsUrl);
  $('#exportBtn').addEventListener('click', downloadState);
  $('#importInput').addEventListener('change', importFile);
  $('#addExpenseBtn').addEventListener('click', () => openExpenseDialog());
  document.querySelectorAll('.close-expense').forEach((b) => b.addEventListener('click', () => els.expenseDialog.close()));
  document.querySelectorAll('.section-collapse-hit').forEach((header) => { header.addEventListener('click', toggleSectionFromHeader); header.addEventListener('keydown', toggleSectionFromHeader); });
  els.expenseForm.addEventListener('submit', saveExpense);
  els.expenseList.addEventListener('click', onExpenseAction);
  els.placesList.addEventListener('click', onPlaceAction);
  els.radarSvg.addEventListener('click', onRadarAction);
  els.radarSvg.addEventListener('keydown', onRadarKeydown);
  document.querySelector('[data-scroll="top"]').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.querySelector('[data-scroll="places"]').addEventListener('click', () => document.querySelector('.places-section').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  document.querySelector('[data-scroll="together"]').addEventListener('click', () => document.querySelector('#togetherSection').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  document.querySelector('[data-scroll="expenses"]').addEventListener('click', () => document.querySelector('#expenseSection').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  els.backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  window.addEventListener('scroll', () => els.backToTop.classList.toggle('show', window.scrollY > 520), { passive: true });
  window.addEventListener('resize', syncPlaceFiltersForViewport, { passive: true });
  $('#traceBtn').addEventListener('click', openTraceDialog);
  $('#closeTraceBtn').addEventListener('click', () => els.traceDialog.close());
  $('#clearTraceBtn').addEventListener('click', () => { traces = []; persistTraces(traces); renderTraces(); });
  $('#copyTraceBtn').addEventListener('click', copyTraces);
  window.addEventListener('error', (event) => trace('error', 'WINDOW_ERROR', event.message || 'Lỗi JavaScript không xác định.', { source: event.filename, line: event.lineno }));
  window.addEventListener('unhandledrejection', (event) => trace('error', 'UNHANDLED_PROMISE', String(event.reason?.message || event.reason || 'Promise rejected')));
}

async function loadFixedHome() {
  try {
    const res = await fetch('/api/config', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const payload = await res.json();
    routingConfigured = Boolean(payload?.routingConfigured);
    collaborationConfig = payload?.collaboration || null;
    if (payload?.home && validCoords(payload.home)) {
      const previous = state.home;
      state.home = sanitizeHome(payload.home);
      trace('info', 'HOME_LOADED', `Đã tải Home: ${state.home.address || 'Home'}.`, { routingConfigured });
      if (!collaborationConfig?.configured && !sameCoords(previous, state.home) && state.places.length) {
        state.places.forEach(applyFallbackDistance);
        refreshAllDistances().then(() => { persistState(state); render(); }).catch(() => { persistState(state); render(); });
      }
      return;
    }
    trace('warn', 'HOME_INVALID', 'HOME_LAT/HOME_LNG chưa hợp lệ trong environment.');
  } catch (error) {
    trace('error', 'CONFIG_FETCH_FAILED', 'Không tải được cấu hình Home.', errorDetails(error));
  }
  state.home = sanitizeHome({});
}


async function initCollaboration() {
  collaborationClient = new SupabaseHttpClient({ url: collaborationConfig.supabaseUrl, key: collaborationConfig.publishableKey });
  repository = new CollaborativeRepository(collaborationClient, collaborationConfig.defaultTripSlug || 'dalat-2026');
  try {
    const connection = await repository.connect();
    if (!connection) {
      $('#authGate').hidden = false;
      $('#authMessage').textContent = 'Đăng nhập để tham gia Trip dùng chung.';
      return false;
    }
    currentUser = connection.user;
    $('#authGate').hidden = true;
    await reloadCollaborativeData('initial');
    updateAccountUi();
    repository.subscribe(() => scheduleRealtimeReload());
    trace('info','COLLAB_CONNECTED',`Đã kết nối Trip ${collaborationConfig.defaultTripSlug}.`,{role:repository.role,userId:currentUser.id});
    return true;
  } catch (error) {
    $('#authGate').hidden = false;
    $('#authMessage').textContent = `Không kết nối được dữ liệu dùng chung: ${error.message}`;
    trace('error','COLLAB_CONNECT_FAILED',error.message,errorDetails(error));
    return false;
  }
}

async function reloadCollaborativeData(reason='realtime') {
  if (!repository) return;
  const remote = await repository.loadAll();
  state.home = remote.home;
  state.places = remote.places;
  state.expenses = remote.expenses;
  votes = remote.votes;
  members = remote.members;
  const selfMember = members.find((member) => member.user_id === currentUser?.id);
  if (selfMember && repository) repository.role = selfMember.role;
  updateAccountUi();
  state.places.forEach((place) => { if (!Number.isFinite(place.distanceMeters) && validCoords(state.home) && validCoords(place)) applyFallbackDistance(place); });
  persistState(state);
  render();
  if (reason !== 'initial') trace('info','REALTIME_SYNC','Đã đồng bộ thay đổi từ nhóm.',{reason});
}
function scheduleRealtimeReload(){clearTimeout(realtimeReloadTimer);realtimeReloadTimer=setTimeout(()=>reloadCollaborativeData('postgres-change').catch(error=>trace('warn','REALTIME_RELOAD_FAILED',error.message,errorDetails(error))),280)}
function updateAccountUi(){const name=currentUser?.user_metadata?.full_name||currentUser?.user_metadata?.name||currentUser?.email||'Tài khoản';if($('#userBtn'))$('#userBtn').textContent=`${name} · ${repository?.role||''}`;if($('#membersBtn'))$('#membersBtn').hidden=!repository;const editable=canEditShared();['#addBtn','#mobileAddBtn','#addExpenseBtn'].forEach(sel=>{const el=$(sel);if(el){el.disabled=!editable;el.title=editable?'':'Bạn đang ở quyền viewer';}})}
async function signOutUser(){if(!collaborationClient)return;if(!confirm('Đăng xuất khỏi Trip?'))return;await collaborationClient.signOut();location.reload()}
function openMembersDialog(){renderMembers();$('#membersDialog')?.showModal()}
function renderMembers(){const list=$('#membersList');if(!list)return;$('#memberRoleInfo').textContent=`Bạn đang là ${repository?.role||'—'} · ${members.length} thành viên.`;list.replaceChildren(...members.map(member=>{const row=document.createElement('article');row.className='member-row';const copy=document.createElement('div');copy.className='member-copy';const strong=document.createElement('strong');strong.textContent=member.profile?.full_name||member.profile?.email||'Thành viên';const span=document.createElement('span');span.textContent=member.profile?.email||member.user_id;copy.append(strong,span);const select=document.createElement('select');select.className='member-role';select.dataset.memberId=member.user_id;['owner','editor','viewer'].forEach(role=>{const o=document.createElement('option');o.value=role;o.textContent=role;o.selected=member.role===role;select.append(o)});select.disabled=repository?.role!=='owner'||member.user_id===currentUser?.id;row.append(copy,select);return row}))}
async function onMemberRoleChange(event){const select=event.target.closest('[data-member-id]');if(!select||!repository)return;try{await repository.updateMemberRole(select.dataset.memberId,select.value);toast('Đã cập nhật quyền thành viên.');await reloadCollaborativeData('member-role')}catch(error){toast(`Không đổi được quyền: ${error.message}`);await reloadCollaborativeData('member-role-failed')}}
function canEditShared(){return !repository || repository.canEdit()}

function seedPlacesIfEmpty() {
  if (state.places.length) return;
  state.places = createDemoPlaces();
  state.places.forEach(applyFallbackDistance);
}

function syncPlaceFiltersForViewport() {
  if (!els.placeFilters) return;
  if (window.matchMedia('(min-width: 821px)').matches) {
    els.placeFilters.open = true;
    return;
  }
  if (!els.placeFilters.dataset.mobileInitialized) {
    els.placeFilters.open = false;
    els.placeFilters.dataset.mobileInitialized = '1';
  }
}

function render() {
  const radiusKm = Number(els.radius.value);
  const filtered = filterAndSortPlaces(state.places, { radiusKm, category: els.category.value, query: els.search.value, sort: els.sort.value });
  els.homeTitle.textContent = state.home.address || 'Home chưa cấu hình';
  els.homeMeta.textContent = validCoords(state.home) ? `${state.home.lat.toFixed(7)}, ${state.home.lng.toFixed(7)} · ${routingConfigured ? 'ORS sẵn sàng' : 'đang dùng fallback nếu cần'}` : 'Thêm HOME_NAME, HOME_LAT, HOME_LNG vào .env.local rồi restart npm run dev.';
  els.statTotal.textContent = state.places.length;
  const nearby = state.places.filter(p => Number.isFinite(p.distanceMeters) && p.distanceMeters <= radiusKm * 1000);
  els.statNearby.textContent = nearby.length;
  els.statMust.textContent = state.places.filter(p => p.priority === 'must').length;
  const known = state.places.filter(p => Number.isFinite(p.distanceMeters));
  els.statAvg.textContent = known.length ? formatDistance(known.reduce((s,p)=>s+p.distanceMeters,0)/known.length) : '—';
  const page = paginateItems(filtered, currentPage, uiPrefs.pageSize);
  currentPage = page.currentPage;
  els.resultCount.textContent = `${filtered.length} địa điểm`;
  if (els.filterSummary) els.filterSummary.textContent = `${radiusKm >= 9999 ? 'Mọi khoảng cách' : `≤ ${radiusKm} km`} · ${placeCategoryLabel(els.category.value)}`;
  els.placesList.replaceChildren(...page.items.map(placeRow));
  els.emptyState.hidden = filtered.length > 0;
  renderPagination(page);
  try { renderRadar(); } catch (error) { trace('error', 'RADAR_RENDER_FAILED', 'Không thể render radar vị trí.', errorDetails(error)); if (els.radarSummary) els.radarSummary.textContent = 'Radar tạm thời không hiển thị · mở Nhật ký để xem Trace.'; }
  renderRecommendations(); renderClusters(); renderExpenses();
}

function renderRadar() { renderRadarView({ els, state }); }

function renderPagination(page) {
  const hasItems = page.totalItems > 0;
  els.pagination.hidden = !hasItems;
  if (!hasItems) { els.pageNumbers.replaceChildren(); els.pageSummary.textContent = ''; return; }
  els.prevPageBtn.disabled = page.currentPage <= 1;
  els.nextPageBtn.disabled = page.currentPage >= page.totalPages;
  const pages = visiblePageNumbers(page.currentPage, page.totalPages);
  els.pageNumbers.replaceChildren(...pages.map((number) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `page-number${number === page.currentPage ? ' active' : ''}`;
    button.textContent = String(number); button.dataset.page = String(number);
    button.setAttribute('aria-label', `Trang ${number}`);
    if (number === page.currentPage) button.setAttribute('aria-current', 'page');
    return button;
  }));
  const from = page.totalItems ? page.startIndex + 1 : 0;
  els.pageSummary.textContent = `${from}–${page.endIndex} / ${page.totalItems} · Trang ${page.currentPage}/${page.totalPages}`;
}
function visiblePageNumbers(current, total) {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: 5 }, (_, i) => start + i);
}
function changePage(nextPage) {
  const target = Math.max(1, Number(nextPage) || 1);
  if (target === currentPage) return;
  currentPage = target; render();
  document.querySelector('.places-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function placeRow(place) {
  const row = document.createElement('article'); row.className='place-row'; row.dataset.id=place.id;
  const main=document.createElement('div'); main.className='place-main';
  const h=document.createElement('h3'); h.textContent=`${categoryIcon(place.category)} ${place.name}`;
  const p=document.createElement('p'); p.textContent=`${priorityLabel(place.priority)} · ${place.address || `${place.lat?.toFixed(5)}, ${place.lng?.toFixed(5)}`}`;
  const meta=document.createElement('div'); meta.className='route-meta';
  const source=document.createElement('span'); source.className=`route-pill ${place.routeSource === 'ors' ? 'real' : 'fallback'}`; source.textContent=place.routeSource === 'ors' ? '✓ Route ORS' : '≈ ETA Đà Lạt';
  const eta=document.createElement('span'); eta.className='route-pill'; eta.textContent=formatDuration(place.durationSeconds);
  meta.append(source,eta);
  const voteBtn=document.createElement('button');voteBtn.type='button';voteBtn.className=`vote-btn${hasUserVoted(place.id,currentUser?.id,votes)?' voted':''}`;voteBtn.dataset.action='vote';voteBtn.textContent=`♥ ${votes.filter(v=>v.place_id===place.id).length}`;voteBtn.title='Vote địa điểm';voteBtn.disabled=!currentUser;meta.append(voteBtn); main.append(h,p,meta);
  const distance=document.createElement('div'); distance.className='distance'; const strong=document.createElement('strong'); strong.textContent=formatDistance(place.distanceMeters); const span=document.createElement('span'); span.textContent='từ Home'; distance.append(strong,span);
  const actions=document.createElement('div'); actions.className='row-actions'; actions.append(actionButton('G','Mở Google Maps','map','map-google'),actionButton('✎','Sửa','edit'),actionButton('↻','Tính lại','refresh'),actionButton('×','Xóa','delete','danger'));
  row.append(main,distance,actions); return row;
}
function actionButton(text,label,action,extra=''){const b=document.createElement('button');b.type='button';b.className=`icon-btn ${extra}`.trim();b.textContent=text;b.title=label;b.setAttribute('aria-label',label);b.dataset.action=action;return b}

function renderRecommendations() {
  const items = recommendPlaces(state.places, votes, 6);
  els.recommendations.replaceChildren(...items.map((p,i)=>{
    const el=document.createElement('article');el.className='recommend-item';
    if(validCoords(p)){el.classList.add('recommend-link');el.tabIndex=0;el.setAttribute('role','link');el.setAttribute('aria-label',`Mở ${p.name} trên Google Maps`);el.addEventListener('click',()=>openGoogleMaps(p.lat,p.lng,p.name));el.addEventListener('keydown',(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openGoogleMaps(p.lat,p.lng,p.name)}})}
    const rank=document.createElement('div');rank.className='rank';rank.textContent=`#${i+1}`;const h=document.createElement('h3');h.textContent=`${categoryIcon(p.category)} ${p.name}`;const vote=document.createElement('div');vote.className='vote-meta';vote.textContent=`♥ ${p.voteCount || 0} vote`;const meta=document.createElement('div');meta.className='meta';meta.textContent=`${formatDistance(p.distanceMeters)} · ${formatDuration(p.durationSeconds)} · ${priorityLabel(p.priority)}`;el.append(rank,h,vote,meta);return el;
  }));
  if (!items.length) { const p=document.createElement('p');p.className='meta';p.textContent='Thêm địa điểm có tọa độ để nhận gợi ý.';els.recommendations.replaceChildren(p); }
}
function renderClusters(){
  const groups=groupNearby(state.places,1800).filter(g=>g.length>1).slice(0,6);
  els.clusters.replaceChildren(...groups.map((group,index)=>{
    const card=document.createElement('article');card.className='cluster';
    const head=document.createElement('div');head.className='cluster-head';
    const title=document.createElement('strong');title.textContent=`Cụm ${index+1}`;
    const count=document.createElement('span');count.textContent=`${group.length} nơi`;
    head.append(title,count);
    const list=document.createElement('div');list.className='cluster-places';
    group.slice(0,6).forEach((place)=>{
      const item=document.createElement('button');item.type='button';item.className='cluster-place';
      const icon=document.createElement('span');icon.textContent=categoryIcon(place.category);
      const copy=document.createElement('span');
      const name=document.createElement('b');name.textContent=place.name;
      const meta=document.createElement('small');meta.textContent=`${formatDistance(place.distanceMeters)} · ${formatDuration(place.durationSeconds)}`;
      copy.append(name,meta);item.append(icon,copy);
      if(validCoords(place)) item.addEventListener('click',()=>openGoogleMaps(place.lat,place.lng,place.name));
      else item.disabled=true;
      list.append(item);
    });
    card.append(head,list);return card;
  }));
  if(!groups.length){const p=document.createElement('p');p.className='meta';p.textContent='Chưa đủ địa điểm có tọa độ để gom cụm.';els.clusters.replaceChildren(p)}
}
function renderExpenses(){
  const expenses = [...(state.expenses || [])].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  els.expenseTotal.textContent = formatMoney(totalExpenses(expenses));
  els.expenseCount.textContent = `${expenses.length} khoản`;
  els.expenseEmpty.hidden = expenses.length > 0;
  els.expenseList.replaceChildren(...expenses.map(expenseRow));
}
function expenseRow(expense){
  const row=document.createElement('article');row.className='expense-row';row.dataset.expenseId=expense.id;
  const main=document.createElement('div');main.className='expense-main';
  const h=document.createElement('h3');h.textContent=`${expenseCategoryIcon(expense.category)} ${expenseCategoryLabel(expense.category)}`;
  const meta=document.createElement('p');meta.textContent=`${expense.payer} · ${new Date(expense.createdAt).toLocaleDateString('vi-VN')}`;
  if(expense.note){const note=document.createElement('p');note.className='expense-note';note.textContent=expense.note;main.append(h,meta,note)}else main.append(h,meta);
  const amount=document.createElement('strong');amount.className='expense-amount';amount.textContent=formatMoney(expense.amountVnd);
  const actions=document.createElement('div');actions.className='expense-actions';actions.append(expenseActionButton('✎','Sửa khoản chi','edit'),expenseActionButton('×','Xóa khoản chi','delete','danger'));
  row.append(main,amount,actions);return row;
}
function expenseActionButton(text,label,action,extra=''){const b=document.createElement('button');b.type='button';b.className=`icon-btn ${extra}`.trim();b.textContent=text;b.title=label;b.setAttribute('aria-label',label);b.dataset.expenseAction=action;return b}
function openExpenseDialog(expense=null){els.expenseForm.reset();els.expenseMessage.textContent='';els.expenseId.value=expense?.id||'';els.expenseDialogTitle.textContent=expense?'Sửa khoản chi':'Thêm khoản chi';if(expense){els.expensePayer.value=expense.payer;els.expenseCategory.value=expense.category;els.expenseAmount.value=expense.amountVnd??'';els.expenseNote.value=expense.note||'';}els.expenseDialog.showModal();setTimeout(()=>els.expensePayer.focus(),50)}
async function saveExpense(event){
  event.preventDefault();els.expenseMessage.textContent='';
  const input=sanitizeExpense({id:els.expenseId.value||(repository&&crypto.randomUUID?crypto.randomUUID():undefined),payer:els.expensePayer.value,category:els.expenseCategory.value,amountVnd:els.expenseAmount.value,note:els.expenseNote.value,createdAt:state.expenses?.find(x=>x.id===els.expenseId.value)?.createdAt});
  if(!canEditShared()){const id=trace('warn','ROLE_VIEWER','Viewer không thể sửa chi tiêu.');els.expenseMessage.textContent=`Bạn đang ở quyền viewer · Trace ${id}`;return}
  const errors=validateExpense(input);if(errors.length){const id=trace('error','EXPENSE_VALIDATION',errors[0]);els.expenseMessage.textContent=`${errors[0]} · Trace ${id}`;return}
  setBusy(els.saveExpenseBtn,true,'Đang lưu…');
  try {
    state.expenses ||= [];
    let saved=input;if(repository)saved=await repository.saveExpense(input);
    const idx=state.expenses.findIndex(x=>x.id===saved.id);if(idx>=0)state.expenses[idx]=saved;else state.expenses.push(saved);
    persistState(state);renderExpenses();els.expenseDialog.close();trace('info',idx>=0?'EXPENSE_UPDATED':'EXPENSE_ADDED',`${input.payer} · ${formatMoney(input.amountVnd)}`);toast(idx>=0?'Đã cập nhật khoản chi.':'Đã lưu khoản chi.');
  } catch (error) {
    const id=trace('error','EXPENSE_SAVE_FAILED',error.message,errorDetails(error));
    els.expenseMessage.textContent=`Không lưu được khoản chi: ${error.message} · Trace ${id}`;
  } finally {
    setBusy(els.saveExpenseBtn,false,'Lưu khoản chi');
  }
}

async function onExpenseAction(event){const btn=event.target.closest('[data-expense-action]');if(!btn)return;const row=btn.closest('[data-expense-id]');const expense=(state.expenses||[]).find(x=>x.id===row?.dataset.expenseId);if(!expense)return;if(btn.dataset.expenseAction==='edit'){if(!canEditShared())return toast('Bạn đang ở quyền viewer.');openExpenseDialog(expense)}if(btn.dataset.expenseAction==='delete'){if(!canEditShared())return toast('Bạn đang ở quyền viewer.');if(confirm(`Xóa khoản ${formatMoney(expense.amountVnd)} do ${expense.payer} chi?`)){if(repository)await repository.deleteExpense(expense.id);state.expenses=state.expenses.filter(x=>x.id!==expense.id);persistState(state);renderExpenses();trace('info','EXPENSE_DELETED',`${expense.payer} · ${formatMoney(expense.amountVnd)}`);toast('Đã xóa khoản chi.')}}}


function openPlaceDialog(place=null){els.placeForm.reset();els.placeMessage.textContent='';els.placeId.value=place?.id||'';els.placeDialogTitle.textContent=place?'Sửa địa điểm':'Thêm địa điểm';if(place){els.placeName.value=place.name;els.placeAddress.value=place.address;els.placeCategory.value=place.category;els.placePriority.value=place.priority;els.placeNote.value=place.note;els.placeLat.value=place.lat??'';els.placeLng.value=place.lng??'';}els.placeDialog.showModal();setTimeout(()=>els.placeName.focus(),50)}
function openHomeDialog(){els.homeMessage.textContent=repository?'Home đang lấy từ Trip dùng chung trên Supabase. Chỉnh seed/DB rồi đồng bộ lại nếu cần.':(validCoords(state.home)?'Để đổi Home, sửa .env.local rồi restart server.':'Home chưa được cấu hình trong environment.');els.homeAddress.value=state.home.address||'';els.homeLat.value=state.home.lat??'';els.homeLng.value=state.home.lng??'';els.homeDialog.showModal()}
function fillCoordsFromMapsUrl(){const coords=parseGoogleMapsCoordinates(els.placeMapsUrl.value);if(!coords)return;els.placeLat.value=coords.lat;els.placeLng.value=coords.lng;els.placeMessage.textContent=`✓ Đã lấy tọa độ ${coords.lat}, ${coords.lng}`}

async function savePlace(event){
  event.preventDefault(); els.placeMessage.textContent='';
  const urlCoords=parseGoogleMapsCoordinates(els.placeMapsUrl.value); const lat=urlCoords?.lat ?? els.placeLat.value; const lng=urlCoords?.lng ?? els.placeLng.value;
  const input=sanitizePlace({id:els.placeId.value||(repository&&crypto.randomUUID?crypto.randomUUID():undefined),name:els.placeName.value,address:els.placeAddress.value,category:els.placeCategory.value,priority:els.placePriority.value,note:els.placeNote.value,lat,lng,source:urlCoords?'google-maps-url':'manual'});
  if(!canEditShared()){showFormError('Bạn đang ở quyền viewer nên không thể sửa địa điểm.','ROLE_VIEWER');return}
  const errors=validatePlace(input); if(errors.length){showFormError(errors[0],'PLACE_VALIDATION');return}
  if(!validCoords(input)){showFormError('Cần Latitude/Longitude hoặc paste Google Maps URL có tọa độ.','PLACE_COORDS_MISSING');return}
  if(!validCoords(state.home)){showFormError('Home chưa cấu hình. Kiểm tra Home của Trip.','HOME_MISSING');return}
  setBusy(els.savePlaceBtn,true,'Đang lưu…'); let usedFallback=false;
  try {
    try { await calculateDistance(input); }
    catch (error) { applyFallbackDistance(input); usedFallback=true; trace('warn','ROUTE_FALLBACK',`Đã lưu ${input.name} bằng ETA fallback.`,errorDetails(error)); }
    let saved=input; if(repository) saved=await repository.savePlace(input);
    const idx=state.places.findIndex(p=>p.id===saved.id); if(idx>=0)state.places[idx]=saved; else state.places.push(saved);
    persistState(state); render(); els.placeDialog.close(); toast(usedFallback?'Đã lưu · đang dùng ETA Đà Lạt ước tính.':'Đã lưu · khoảng cách từ ORS, ETA đã hiệu chỉnh cho Đà Lạt.');
  } catch (error) {
    const id=trace('error','PLACE_SAVE_FAILED',error.message,errorDetails(error));
    els.placeMessage.textContent=`Không lưu được địa điểm: ${error.message} · Trace ${id}`;
  } finally {
    setBusy(els.savePlaceBtn,false,'Lưu địa điểm');
  }
}

function showFormError(message, code){const traceId=trace('error',code,message);els.placeMessage.textContent=`${message} · Trace ${traceId}`}

async function refreshAllDistances(){
  const places=state.places.filter(validCoords); if(!validCoords(state.home)||!places.length)return;
  try{
    const result=await api('/api/matrix',{origin:{lat:state.home.lat,lng:state.home.lng},destinations:places.map(p=>({lat:p.lat,lng:p.lng}))});
    places.forEach((place,index)=>{const route=result.results?.[index];if(Number.isFinite(route?.distanceMeters)){place.distanceMeters=route.distanceMeters;place.durationSeconds=calibrateDurationSeconds(route.distanceMeters,route.durationSeconds);place.routeSource='ors'}else applyFallbackDistance(place)});
    trace('info','MATRIX_REFRESH_OK',`Đã cập nhật ${places.length} địa điểm bằng ORS.`);
  }catch(err){places.forEach(applyFallbackDistance);trace('warn','MATRIX_REFRESH_FALLBACK','ORS không sẵn sàng; chuyển toàn bộ sang ETA fallback.',errorDetails(err));throw err}
}
async function calculateDistance(place){
  if(!validCoords(state.home)||!validCoords(place)){place.distanceMeters=null;place.durationSeconds=null;return}
  try{const result=await api('/api/route',{origin:{lat:state.home.lat,lng:state.home.lng},destination:{lat:place.lat,lng:place.lng}});place.distanceMeters=result.distanceMeters;place.durationSeconds=calibrateDurationSeconds(result.distanceMeters,result.durationSeconds);place.routeSource='ors'}catch(err){applyFallbackDistance(place);throw err}
}
function applyFallbackDistance(place){const straight=haversineMeters(state.home,place);const road=estimateRoadMeters(straight);place.distanceMeters=road;place.durationSeconds=estimateDurationSeconds(road);place.routeSource='fallback'}
async function api(url,body){const clientTrace=uid('trace');const started=performance.now();try{const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Client-Trace-Id':clientTrace},body:JSON.stringify(body)});const payload=await res.json().catch(()=>({}));if(!res.ok){const err=new Error(payload.error||`HTTP ${res.status}`);err.code=payload.code||`HTTP_${res.status}`;err.traceId=clientTrace;throw err}trace('info','API_OK',`${url} ${Math.round(performance.now()-started)}ms`,{traceId:clientTrace});return payload}catch(error){trace('error','API_FAILED',`${url}: ${error.message}`,{traceId:clientTrace,code:error.code});throw error}}

async function onPlaceAction(event){const btn=event.target.closest('[data-action]');if(!btn)return;const row=btn.closest('[data-id]');const place=state.places.find(p=>p.id===row?.dataset.id);if(!place)return;
  if(btn.dataset.action==='vote'){if(!repository||!currentUser)return;const voted=hasUserVoted(place.id,currentUser.id,votes);try{await repository.setVote(place.id,!voted);await reloadCollaborativeData('vote');toast(voted?'Đã bỏ vote.':'Đã vote địa điểm ♥');}catch(error){toast(`Vote lỗi: ${error.message}`)}return}
  if(btn.dataset.action==='edit'){if(!canEditShared())return toast('Bạn đang ở quyền viewer.');openPlaceDialog(place)}
  if(btn.dataset.action==='delete'){if(!canEditShared())return toast('Bạn đang ở quyền viewer.');if(confirm(`Xóa “${place.name}”?`)){if(repository)await repository.deletePlace(place.id);state.places=state.places.filter(p=>p.id!==place.id);persistState(state);render();toast('Đã xóa địa điểm.')}}
  if(btn.dataset.action==='map'){openGoogleMaps(place.lat,place.lng,place.name)}
  if(btn.dataset.action==='refresh'){if(!canEditShared())return toast('Bạn đang ở quyền viewer.');setBusy(btn,true,'…');try{await calculateDistance(place);if(repository)await repository.savePlace(place);persistState(state);render();toast('Đã cập nhật route và ETA.')}catch(error){applyFallbackDistance(place);if(repository)await repository.savePlace(place).catch(()=>{});persistState(state);render();const id=trace('warn','PLACE_REFRESH_FALLBACK',`Không lấy được ORS cho ${place.name}; dùng fallback.`,errorDetails(error));toast(`ORS lỗi · dùng ETA fallback · Trace ${id}`)}finally{setBusy(btn,false,'↻')}}}

function onRadarAction(event){const target=event.target.closest('[data-radar-map]');if(!target)return;openGoogleMaps(Number(target.dataset.lat),Number(target.dataset.lng),target.getAttribute('aria-label')||'Radar place')}
function onRadarKeydown(event){if(event.key!=='Enter'&&event.key!==' ')return;const target=event.target.closest('[data-radar-map]');if(!target)return;event.preventDefault();openGoogleMaps(Number(target.dataset.lat),Number(target.dataset.lng),target.getAttribute('aria-label')||'Radar place')}

function toggleSectionFromHeader(event){
  if(event.type==='keydown' && event.key!=='Enter' && event.key!==' ')return;
  const header=event.currentTarget;
  const interactive=event.target.closest('button,a,input,select,textarea,label,summary,details');
  if(interactive && interactive!==header)return;
  if(event.type==='keydown')event.preventDefault();
  const section=header.closest('.collapsible-section');
  if(!section)return;
  const collapsed=section.classList.toggle('section-collapsed');
  header.setAttribute('aria-expanded',String(!collapsed));
}
function openGoogleMaps(lat,lng,label='Địa điểm'){const url=googleMapsCoordinateUrl(lat,lng);if(!url){const id=trace('warn','MAP_COORDS_INVALID',`Không thể mở Google Maps cho ${label}.`,{lat,lng});toast(`Tọa độ không hợp lệ · Trace ${id}`);return}window.open(url,'_blank','noopener,noreferrer')}

function downloadState(){const blob=new Blob([exportState(state)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`dalat-nearby-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url)}
async function importFile(event){const file=event.target.files?.[0];if(!file)return;try{const next=importState(await file.text());if(repository){if(!canEditShared())throw new Error('Viewer không thể import dữ liệu vào Trip.');for(const raw of next.places){const p=sanitizePlace({...raw,id:crypto.randomUUID(),source:'imported'});if(validCoords(state.home)&&validCoords(p))applyFallbackDistance(p);await repository.savePlace(p)}for(const raw of next.expenses||[]){const e=sanitizeExpense({...raw,id:crypto.randomUUID()});await repository.saveExpense(e)}await reloadCollaborativeData('import');toast(`Đã merge ${next.places.length} địa điểm · ${(next.expenses||[]).length} khoản chi vào Trip.`);}else{state.places=next.places;state.expenses=next.expenses||[];state.places.forEach(applyFallbackDistance);persistState(state);render();toast(`Đã nhập ${state.places.length} địa điểm · ${state.expenses.length} khoản chi.`)}trace('info','IMPORT_OK',`Đã nhập ${next.places.length} địa điểm.`)}catch(error){const id=trace('error','IMPORT_FAILED','Không thể nhập file JSON.',errorDetails(error));toast(`${error.message||'File JSON không hợp lệ'} · Trace ${id}`)}finally{event.target.value=''}}


function trace(level,code,message,details={}){const entry={id:uid('t').slice(-10),time:new Date().toISOString(),level,code,message,details:safeDetails(details)};traces.push(entry);traces=traces.slice(-MAX_TRACES);persistTraces(traces);if(level==='error')console.error(`[${entry.id}] ${code}: ${message}`,details);else if(level==='warn')console.warn(`[${entry.id}] ${code}: ${message}`,details);return entry.id}
function safeDetails(details){try{return JSON.parse(JSON.stringify(details||{}))}catch{return {note:'details-unserializable'}}}
function errorDetails(error){return {message:error?.message||String(error),code:error?.code||null,traceId:error?.traceId||null}}
function openTraceDialog(){renderTraces();els.traceDialog.showModal()}
function renderTraces(){els.systemHealth.textContent=`Home: ${validCoords(state.home)?'OK':'CHƯA CẤU HÌNH'} · Routing: ${routingConfigured?'ORS ENABLED':'FALLBACK READY'} · Logs: ${traces.length}`;const items=[...traces].reverse().map(t=>{const el=document.createElement('article');el.className=`trace-item ${t.level}`;const top=document.createElement('div');top.className='trace-top';const strong=document.createElement('strong');strong.textContent=`${t.level.toUpperCase()} · ${t.code}`;const time=document.createElement('span');time.textContent=new Date(t.time).toLocaleTimeString('vi-VN');top.append(strong,time);const msg=document.createElement('div');msg.textContent=t.message;const code=document.createElement('div');code.className='trace-code';code.textContent=`Trace ${t.id}${Object.keys(t.details||{}).length?` · ${JSON.stringify(t.details)}`:''}`;el.append(top,msg,code);return el});els.traceList.replaceChildren(...items);if(!items.length){const p=document.createElement('p');p.className='meta';p.textContent='Chưa có log.';els.traceList.replaceChildren(p)}}
async function copyTraces(){const text=traces.map(t=>`${t.time} ${t.level.toUpperCase()} ${t.code} [${t.id}] ${t.message} ${JSON.stringify(t.details)}`).join('\n');try{await navigator.clipboard.writeText(text);toast('Đã copy diagnostic log.')}catch{toast('Không copy được log trên trình duyệt này.')}}

