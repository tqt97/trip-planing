import { calibrateDurationSeconds, estimateDurationSeconds, estimateRoadMeters, exportState, filterAndSortPlaces, googleMapsCoordinateUrl, haversineMeters, importState, paginateItems, parseGoogleMapsCoordinates, hasUserVoted, sanitizeChecklist, sanitizeExpense, sanitizeHome, sanitizePlace, sanitizeTripSettings, uid, validateChecklist, validateExpense, validatePlace } from '/src/core.js';
import { SupabaseHttpClient } from '/src/data/supabase-client.js';
import { CollaborativeRepository } from '/src/data/repository.js';
import { loadState, loadTraces, loadUiPrefs, MAX_TRACES, normalizePageSize, persistState, saveTraces as persistTraces, saveUiPrefs as persistUiPrefs } from '/src/app/storage.js';
import { $, collectElements, createToast, formatDistance, formatMoney, placeCategoryLabel, sameCoords, setBusy, validCoords } from '/src/app/ui.js';
import { renderRadarView } from '/src/app/radar-view.js';
import { normalizeUiConfig, applyUiConfig } from '/src/config/ui-config.js';
import { createPlaceRow, renderPagination } from '/src/features/places/place-view.js';
import { renderRecommendations, renderClusters } from '/src/features/recommendations/recommendation-view.js';
import { createExpensePager } from '/src/features/expenses/expense-controller.js';
import { createChecklistController } from '/src/features/checklists/checklist-controller.js';
import { createAlbumController } from '/src/features/album/album-controller.js';
import { fileToDataUrl, previewPlaceImage } from '/src/features/places/place-media.js';
import { renderMemberList } from '/src/features/members/member-view.js';
import { createDiagnostics } from '/src/features/diagnostics/diagnostics.js';
import { createDemoPlaces } from '/src/app/demo-seed.js';
import { createAppShell } from '/src/app/app-shell.js';
import { bindScrollControl } from '/src/app/bindings.js';

const APP_STARTED_AT = performance.now();
const state = loadState();
state.tripSettings = sanitizeTripSettings(state.tripSettings || { peopleCount: 4 });
state.checklists = Array.isArray(state.checklists) ? state.checklists : [];
state.album = Array.isArray(state.album) ? state.album : [];
let uiPrefs = loadUiPrefs();
let uiConfig = normalizeUiConfig();
let currentPage = 1;
let routingConfigured = false;
let dataConfig = { provider: 'localStorage' };
let collaborationConfig = null;
let collaborationClient = null;
let repository = null;
let currentUser = null;
let votes = [];
let members = [];
let realtimeReloadTimer = null;
const els = collectElements();
const toast = createToast(els.toast);
const diagnostics = createDiagnostics({ initial: loadTraces(), max: MAX_TRACES, persist: persistTraces, toast, list: els.traceList, health: els.systemHealth, dialog: els.traceDialog });
const trace = diagnostics.trace;
const errorDetails = diagnostics.details;
const appShell = createAppShell({ bootGate: $('#bootGate'), bootMessage: $('#bootMessage'), authGate: $('#authGate'), authMessage: $('#authMessage'), loginButton: $('#googleLoginBtn') });
const checklistController = createChecklistController({ els, state, getRepository: () => repository, getCurrentUser: () => currentUser, getMembers: () => members, persistState, toast, trace, errorDetails });
const albumController = createAlbumController({ els, state, getRepository: () => repository, getCurrentUser: () => currentUser, persistState, toast, trace, errorDetails });
const expensePager = createExpensePager({ els, state, pageSize: 8 });

await init();
async function init() {
  appShell.boot('Đang tải cấu hình chuyến đi…');
  bind();
  await loadFixedHome();
  applyConfiguredUiDefaults();
  els.pageSize.value = String(uiPrefs.pageSize);
  syncPlaceFiltersForViewport();
  trace('info', 'APP_BOOT', 'Ứng dụng khởi động.', { viewport: `${window.innerWidth}x${window.innerHeight}`, pageSize: uiPrefs.pageSize, uiTitle: uiConfig.title });
  if (dataConfig.provider === 'supabase') {
    appShell.boot('Đang kiểm tra phiên Google và đồng bộ dữ liệu nhóm…');
    const ready = await initCollaboration();
    if (!ready) return;
  } else {
    seedPlacesIfEmpty();
    updateLocalModeUi();
  }
  persistState(state);
  render();
  appShell.ready();
  trace('info', 'APP_READY', `Ứng dụng sẵn sàng sau ${Math.round(performance.now() - APP_STARTED_AT)}ms.`, { bootMs: Math.round(performance.now() - APP_STARTED_AT), collaborative: Boolean(repository) });
}
function bind() {
  $('#googleLoginBtn')?.addEventListener('click', () => { if (!collaborationClient) return; appShell.setLoginBusy(true); try { collaborationClient.signInWithGoogle(`${location.origin}/`); } catch (error) { appShell.setLoginBusy(false); trace('error','SUPABASE_LOGIN_FAILED',error.message,errorDetails(error)); } });
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
  $('#addChecklistBtn')?.addEventListener('click', () => checklistController.open()); $('#addAlbumBtn')?.addEventListener('click', () => albumController.open());
  document.querySelectorAll('.close-checklist').forEach((b) => b.addEventListener('click', () => els.checklistDialog.close()));
  els.checklistForm?.addEventListener('submit', checklistController.save); els.checklistList?.addEventListener('click', checklistController.action);
  els.albumForm?.addEventListener('submit', albumController.save); els.albumList?.addEventListener('click', albumController.action);
  els.albumFilter?.addEventListener('change', albumController.resetPage); els.albumPrevPageBtn?.addEventListener('click', () => albumController.changePage(Number(els.albumPageNumbers?.querySelector('[aria-current="page"]')?.dataset.page || 1) - 1));
  els.albumNextPageBtn?.addEventListener('click', () => albumController.changePage(Number(els.albumPageNumbers?.querySelector('[aria-current="page"]')?.dataset.page || 1) + 1)); els.albumPageNumbers?.addEventListener('click', (event) => { const btn = event.target.closest('[data-page]'); if (btn) albumController.changePage(Number(btn.dataset.page)); });
  expensePager.bind();
  document.querySelectorAll('.close-album').forEach((b)=>b.addEventListener('click',()=>els.albumDialog.close())); document.querySelectorAll('.close-album-lightbox').forEach((b)=>b.addEventListener('click',()=>els.albumLightbox.close()));
  els.peopleCount?.addEventListener('change', onPeopleCountChange); els.placeImage?.addEventListener('change', () => previewPlaceImage(els));
  document.querySelectorAll('.close-expense').forEach((b) => b.addEventListener('click', () => els.expenseDialog.close()));
  document.querySelectorAll('.section-collapse-hit').forEach((header) => { header.addEventListener('click', toggleSectionFromHeader); header.addEventListener('keydown', toggleSectionFromHeader); });
  els.expenseForm.addEventListener('submit', saveExpense);
  els.expenseList.addEventListener('click', onExpenseAction);
  els.placesList.addEventListener('click', onPlaceAction);
  els.radarSvg.addEventListener('click', onRadarAction);
  els.radarSvg.addEventListener('keydown', onRadarKeydown);
  bindScrollControl({ selector: '[data-scroll="top"]', trace });
  bindScrollControl({ selector: '[data-scroll="places"]', targetSelector: '.places-section', trace });
  bindScrollControl({ selector: '[data-scroll="together"]', targetSelector: '#togetherSection', trace });
  bindScrollControl({ selector: '[data-scroll="checklist"]', targetSelector: '#checklistSection', trace });
  bindScrollControl({ selector: '[data-scroll="expenses"]', targetSelector: '#expenseSection', trace });
  els.backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  window.addEventListener('scroll', () => els.backToTop.classList.toggle('show', window.scrollY > 520), { passive: true });
  window.addEventListener('resize', syncPlaceFiltersForViewport, { passive: true });
  $('#traceBtn').addEventListener('click', openTraceDialog);
  $('#closeTraceBtn').addEventListener('click', () => els.traceDialog.close());
  $('#clearTraceBtn').addEventListener('click', diagnostics.clear);
  $('#copyTraceBtn').addEventListener('click', diagnostics.copy);
  window.addEventListener('error', (event) => trace('error', 'WINDOW_ERROR', event.message || 'Lỗi JavaScript không xác định.', { source: event.filename, line: event.lineno }));
  window.addEventListener('unhandledrejection', (event) => trace('error', 'UNHANDLED_PROMISE', String(event.reason?.message || event.reason || 'Promise rejected')));
}
async function loadFixedHome() {
  try {
    const res = await fetch('/api/config', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const payload = await res.json();
    routingConfigured = Boolean(payload?.routingConfigured);
    dataConfig = payload?.data || { provider: 'localStorage' };
    collaborationConfig = payload?.collaboration || null;
    uiConfig = applyUiConfig(payload?.ui || uiConfig);
    if (!uiPrefs.hasStoredPageSize) uiPrefs = loadUiPrefs({ pageSize: uiConfig.defaultPageSize });
    if (payload?.home && validCoords(payload.home)) {
      const previous = state.home;
      state.home = sanitizeHome(payload.home);
      trace('info', 'HOME_LOADED', `Đã tải Home: ${state.home.address || 'Home'}.`, { routingConfigured });
      if (dataConfig.provider === 'localStorage' && !sameCoords(previous, state.home) && state.places.length) {
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


function applyConfiguredUiDefaults() {
  els.radius.value = String(uiConfig.defaultRadiusKm);
  els.category.value = uiConfig.defaultCategory;
  els.sort.value = uiConfig.defaultSort;
  els.radarRadius.value = String(uiConfig.defaultRadarRadiusKm);
  els.radarCategory.value = uiConfig.defaultRadarCategory;
}


async function initCollaboration() {
  if (!collaborationConfig?.configured) { appShell.auth('Supabase production chưa được cấu hình đầy đủ. Kiểm tra SUPABASE_URL và SUPABASE_PUBLISHABLE_KEY trên Vercel.'); trace('error','SUPABASE_CONFIG_MISSING','APP_ENV=prod nhưng thiếu Supabase config.'); return false; }
  collaborationClient = new SupabaseHttpClient({ url: collaborationConfig.supabaseUrl, key: collaborationConfig.publishableKey });
  repository = new CollaborativeRepository(collaborationClient, collaborationConfig.defaultTripSlug || 'dalat-2026');
  try {
    const connection = await repository.connect();
    if (!connection) {
      appShell.setLoginBusy(false);
      appShell.auth('Đăng nhập để tham gia Trip dùng chung.');
      return false;
    }
    currentUser = connection.user;
    appShell.boot('Đã đăng nhập · đang tải địa điểm, vote và chi tiêu…');
    await reloadCollaborativeData('initial', false);
    updateAccountUi();
    repository.subscribe(() => scheduleRealtimeReload());
    trace('info','COLLAB_CONNECTED',`Đã kết nối Trip ${collaborationConfig.defaultTripSlug}.`,{role:repository.role,userId:currentUser.id});
    return true;
  } catch (error) {
    appShell.setLoginBusy(false);
    appShell.auth(`Không kết nối được dữ liệu dùng chung: ${error.message}`);
    trace('error','COLLAB_CONNECT_FAILED',error.message,errorDetails(error));
    return false;
  }
}

async function reloadCollaborativeData(reason='realtime', renderUi=true) {
  if (!repository) return;
  const remote = await repository.loadAll();
  state.home = remote.home;
  state.places = remote.places;
  state.expenses = remote.expenses;
  state.tripSettings = remote.tripSettings || sanitizeTripSettings({ peopleCount: 4 });
  state.checklists = remote.checklists || [];
  state.album = remote.album || [];
  votes = remote.votes;
  members = remote.members;
  const selfMember = members.find((member) => member.user_id === currentUser?.id);
  if (selfMember && repository) repository.role = selfMember.role;
  updateAccountUi();
  state.places.forEach((place) => { if (!Number.isFinite(place.distanceMeters) && validCoords(state.home) && validCoords(place)) applyFallbackDistance(place); });
  persistState(state);
  if (renderUi) render();
  if (reason !== 'initial') trace('info','REALTIME_SYNC','Đã đồng bộ thay đổi từ nhóm.',{reason});
}
function scheduleRealtimeReload(){clearTimeout(realtimeReloadTimer);realtimeReloadTimer=setTimeout(()=>reloadCollaborativeData('postgres-change').catch(error=>trace('warn','REALTIME_RELOAD_FAILED',error.message,errorDetails(error))),280)}
function updateAccountUi(){const name=currentUser?.user_metadata?.full_name||currentUser?.user_metadata?.name||currentUser?.email||'Tài khoản';if($('#userBtn')){$('#userBtn').hidden=false;$('#userBtn').textContent=`${name} · ${repository?.role||''}`;}if($('#membersBtn'))$('#membersBtn').hidden=!repository;if($('#mobileMembersBtn'))$('#mobileMembersBtn').hidden=!repository;const editable=canEditShared();['#addBtn','#mobileAddBtn','#addExpenseBtn','#addAlbumBtn'].forEach(sel=>{const el=$(sel);if(el){el.disabled=!editable;el.title=editable?'':'Bạn đang ở quyền viewer';}})}
function updateLocalModeUi(){if($('#userBtn'))$('#userBtn').hidden=true;if($('#membersBtn'))$('#membersBtn').hidden=true;if($('#mobileMembersBtn'))$('#mobileMembersBtn').hidden=true;trace('info','DATA_PROVIDER_LOCAL','Đang dùng localStorage trên thiết bị này.');}
async function signOutUser(){if(!collaborationClient)return;if(!confirm('Đăng xuất khỏi Trip?'))return;await collaborationClient.signOut();location.reload()}
function openMembersDialog(){renderMembers();$('#membersDialog')?.showModal()}
function renderMembers(){const list=$('#membersList');if(!list)return;$('#memberRoleInfo').textContent=`Bạn đang là ${repository?.role||'—'} · ${members.length} thành viên.`;renderMemberList(list,members,{currentUserId:currentUser?.id,role:repository?.role})}
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
  els.placesList.replaceChildren(...page.items.map(place => createPlaceRow(place, { currentUserId: currentUser?.id, votes })));
  els.emptyState.hidden = filtered.length > 0;
  renderPagination(els, page);
  try { renderRadar(); } catch (error) { trace('error', 'RADAR_RENDER_FAILED', 'Không thể render radar vị trí.', errorDetails(error)); if (els.radarSummary) els.radarSummary.textContent = 'Radar tạm thời không hiển thị · mở Nhật ký để xem Trace.'; }
  renderRecommendations(els.recommendations, state.places, votes, openGoogleMaps); renderClusters(els.clusters, state.places, openGoogleMaps); expensePager.render(); checklistController.render(); albumController.render();
}

function renderRadar() { renderRadarView({ els, state }); }


function changePage(nextPage) {
  const target = Math.max(1, Number(nextPage) || 1);
  if (target === currentPage) return;
  currentPage = target; render();
  document.querySelector('.places-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


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
    persistState(state);expensePager.reset();els.expenseDialog.close();trace('info',idx>=0?'EXPENSE_UPDATED':'EXPENSE_ADDED',`${input.payer} · ${formatMoney(input.amountVnd)}`);toast(idx>=0?'Đã cập nhật khoản chi.':'Đã lưu khoản chi.');
  } catch (error) {
    const id=trace('error','EXPENSE_SAVE_FAILED',error.message,errorDetails(error));
    els.expenseMessage.textContent=`Không lưu được khoản chi: ${error.message} · Trace ${id}`;
  } finally {
    setBusy(els.saveExpenseBtn,false,'Lưu khoản chi');
  }
}

async function onExpenseAction(event){const btn=event.target.closest('[data-expense-action]');if(!btn)return;const row=btn.closest('[data-expense-id]');const expense=(state.expenses||[]).find(x=>x.id===row?.dataset.expenseId);if(!expense)return;if(btn.dataset.expenseAction==='edit'){if(!canEditShared())return toast('Bạn đang ở quyền viewer.');openExpenseDialog(expense)}if(btn.dataset.expenseAction==='delete'){if(!canEditShared())return toast('Bạn đang ở quyền viewer.');if(confirm(`Xóa khoản ${formatMoney(expense.amountVnd)} do ${expense.payer} chi?`)){if(repository)await repository.deleteExpense(expense.id);state.expenses=state.expenses.filter(x=>x.id!==expense.id);persistState(state);expensePager.render();trace('info','EXPENSE_DELETED',`${expense.payer} · ${formatMoney(expense.amountVnd)}`);toast('Đã xóa khoản chi.')}}}


function openPlaceDialog(place=null){els.placeForm.reset();els.placeMessage.textContent='';els.placeId.value=place?.id||'';els.placeDialogTitle.textContent=place?'Sửa địa điểm':'Thêm địa điểm';const coordsDetails=$('#placeCoordsDetails');if(coordsDetails)coordsDetails.open=window.matchMedia('(max-width: 820px)').matches;els.placeImagePreview.hidden=true;els.placeImagePreview.removeAttribute('src');if(place){els.placeName.value=place.name;els.placeAddress.value=place.address;els.placeCategory.value=place.category;els.placePriority.value=place.priority;els.placeNote.value=place.note;els.placeNoteUrl.value=place.noteUrl||'';els.placeLat.value=place.lat??'';els.placeLng.value=place.lng??'';if(place.imageUrl){els.placeImagePreview.src=place.imageUrl;els.placeImagePreview.hidden=false;}}els.placeDialog.showModal();setTimeout(()=>els.placeName.focus(),50)}
function openHomeDialog(){els.homeMessage.textContent=repository?'Home đang lấy từ Trip dùng chung trên Supabase. Chỉnh seed/DB rồi đồng bộ lại nếu cần.':(validCoords(state.home)?'Để đổi Home, sửa .env.local rồi restart server.':'Home chưa được cấu hình trong environment.');els.homeAddress.value=state.home.address||'';els.homeLat.value=state.home.lat??'';els.homeLng.value=state.home.lng??'';els.homeDialog.showModal()}
function fillCoordsFromMapsUrl(){const coords=parseGoogleMapsCoordinates(els.placeMapsUrl.value);if(!coords)return;els.placeLat.value=coords.lat;els.placeLng.value=coords.lng;els.placeMessage.textContent=`✓ Đã lấy tọa độ ${coords.lat}, ${coords.lng}`}

async function savePlace(event){
  event.preventDefault(); els.placeMessage.textContent='';
  const urlCoords=parseGoogleMapsCoordinates(els.placeMapsUrl.value); const lat=urlCoords?.lat ?? els.placeLat.value; const lng=urlCoords?.lng ?? els.placeLng.value;
  const input=sanitizePlace({id:els.placeId.value||(repository&&crypto.randomUUID?crypto.randomUUID():undefined),name:els.placeName.value,address:els.placeAddress.value,category:els.placeCategory.value,priority:els.placePriority.value,note:els.placeNote.value,noteUrl:els.placeNoteUrl.value,imageUrl:state.places.find(p=>p.id===els.placeId.value)?.imageUrl||'',lat,lng,source:urlCoords?'google-maps-url':'manual'});
  if(els.placeNoteUrl.value.trim() && !input.noteUrl){showFormError('Link ghi chú phải bắt đầu bằng http:// hoặc https://.','PLACE_NOTE_URL');return}
  if(!canEditShared()){showFormError('Bạn đang ở quyền viewer nên không thể sửa địa điểm.','ROLE_VIEWER');return}
  const errors=validatePlace(input); if(errors.length){showFormError(errors[0],'PLACE_VALIDATION');return}
  if(!validCoords(input)){showFormError('Cần Latitude/Longitude hoặc paste Google Maps URL có tọa độ.','PLACE_COORDS_MISSING');return}
  if(!validCoords(state.home)){showFormError('Home chưa cấu hình. Kiểm tra Home của Trip.','HOME_MISSING');return}
  setBusy(els.savePlaceBtn,true,'Đang lưu…'); let usedFallback=false;
  try {
    const imageFile=els.placeImage.files?.[0];
    if(imageFile){ input.imageUrl = repository ? await repository.uploadPlaceImage(imageFile,input.id) : await fileToDataUrl(imageFile); }
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
async function api(url,body){const clientTrace=uid('trace');const started=performance.now();try{const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Client-Trace-Id':clientTrace},body:JSON.stringify(body)});const payload=await res.json().catch(()=>({}));if(!res.ok){const err=new Error(payload.error||`HTTP ${res.status}`);err.code=payload.code||`HTTP_${res.status}`;err.traceId=clientTrace;throw err}const elapsed=Math.round(performance.now()-started);trace(elapsed>1500?'warn':'info',elapsed>1500?'API_SLOW':'API_OK',`${url} ${elapsed}ms`,{traceId:clientTrace,elapsedMs:elapsed});return payload}catch(error){trace('error','API_FAILED',`${url}: ${error.message}`,{traceId:clientTrace,code:error.code});throw error}}

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
async function importFile(event){const file=event.target.files?.[0];if(!file)return;try{const next=importState(await file.text());if(repository){if(!canEditShared())throw new Error('Viewer không thể import dữ liệu vào Trip.');for(const raw of next.places){const p=sanitizePlace({...raw,id:crypto.randomUUID(),source:'imported'});if(validCoords(state.home)&&validCoords(p))applyFallbackDistance(p);await repository.savePlace(p)}for(const raw of next.expenses||[]){const e=sanitizeExpense({...raw,id:crypto.randomUUID()});await repository.saveExpense(e)}for(const raw of next.checklists||[]){const c=sanitizeChecklist({...raw,id:crypto.randomUUID(),createdBy:''});await repository.saveChecklist(c)}for(const raw of next.album||[]){const a={...raw,id:crypto.randomUUID(),imageUrl:String(raw.imageUrl||'').startsWith('http')?raw.imageUrl:''};await repository.saveAlbumItem(a)}if(next.tripSettings?.peopleCount)await repository.updatePeopleCount(next.tripSettings.peopleCount);await reloadCollaborativeData('import');toast(`Đã merge ${next.places.length} địa điểm · ${(next.expenses||[]).length} khoản chi vào Trip.`);}else{state.places=next.places;state.expenses=next.expenses||[];state.checklists=next.checklists||[];state.album=next.album||[];state.tripSettings=next.tripSettings||sanitizeTripSettings({peopleCount:4});state.places.forEach(applyFallbackDistance);persistState(state);render();toast(`Đã nhập ${state.places.length} địa điểm · ${state.expenses.length} khoản chi.`)}trace('info','IMPORT_OK',`Đã nhập ${next.places.length} địa điểm.`)}catch(error){const id=trace('error','IMPORT_FAILED','Không thể nhập file JSON.',errorDetails(error));toast(`${error.message||'File JSON không hợp lệ'} · Trace ${id}`)}finally{event.target.value=''}}



async function onPeopleCountChange(){
  const next=sanitizeTripSettings({peopleCount:els.peopleCount.value});
  const previous=state.tripSettings.peopleCount;
  state.tripSettings=next; expensePager.render(); persistState(state);
  if(repository){
    if(!canEditShared()){state.tripSettings.peopleCount=previous;expensePager.render();toast('Viewer không thể đổi số người.');return}
    try{await repository.updatePeopleCount(next.peopleCount);toast(`Đã đặt ${next.peopleCount} người để chia chi phí.`)}catch(error){state.tripSettings.peopleCount=previous;expensePager.render();toast(`Không lưu được số người: ${error.message}`)}
  }
}

function openTraceDialog(){diagnostics.open(`Home: ${validCoords(state.home)?'OK':'CHƯA CẤU HÌNH'} · Routing: ${routingConfigured?'ORS ENABLED':'FALLBACK READY'}`)}
