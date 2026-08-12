import { sanitizeTimelineItem, validateTimelineItem } from '../../core.js';
import { setBusy } from '../../app/ui.js';
import { userErrorMessage } from '../../app/error-message.js';
import { groupTimelineDays, pickActiveTimelineDate, timelineWindowDates } from './timeline-view.js';

export function createTimelineController({ els, state, getRepository, persistState, toast, trace, errorDetails }) {
  let activeDate = '';

  function render() {
    const days = groupTimelineDays(state.timeline || []);
    const dates = days.map((day) => day.date);
    if (!activeDate || !dates.includes(activeDate)) activeDate = pickActiveTimelineDate(dates);
    const visibleDates = timelineWindowDates(dates, activeDate, 3);
    els.timelineEmpty.hidden = days.length > 0;
    els.timelineCount.textContent = days.length ? `${state.timeline.length} mục · ${days.length} ngày` : '0 mục';
    els.timelineList.replaceChildren();
    if (!days.length) return;
    els.timelineList.append(renderNavigator(dates, visibleDates), renderBoard(days, visibleDates));
  }

  function renderNavigator(dates, visibleDates) {
    const nav = document.createElement('div');
    nav.className = 'timeline-navigator';
    const activeIndex = dates.indexOf(activeDate);
    nav.append(navButton('←', 'Ngày trước', 'prev', activeIndex <= 0));
    const tabs = document.createElement('div');
    tabs.className = 'timeline-day-tabs';
    for (const date of visibleDates) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `timeline-day-tab${date === activeDate ? ' is-active' : ''}`;
      button.dataset.timelineNav = 'date';
      button.dataset.timelineDate = date;
      button.setAttribute('aria-pressed', String(date === activeDate));
      button.textContent = formatDate(date);
      tabs.append(button);
    }
    nav.append(tabs, navButton('→', 'Ngày sau', 'next', activeIndex >= dates.length - 1));
    return nav;
  }

  function renderBoard(days, visibleDates) {
    const board = document.createElement('div');
    board.className = 'timeline-board';
    for (const date of visibleDates) {
      const day = days.find((entry) => entry.date === date);
      if (!day) continue;
      board.append(renderDay(day, date === activeDate));
    }
    return board;
  }

  function renderDay(day, isActive) {
    const column = document.createElement('section');
    column.className = `timeline-day${isActive ? ' is-active' : ''}`;
    column.dataset.timelineDate = day.date;
    const header = document.createElement('header');
    header.className = 'timeline-day-header';
    const title = document.createElement('div');
    const eyebrow = document.createElement('span'); eyebrow.textContent = formatWeekday(day.date);
    const h3 = document.createElement('h3'); h3.textContent = formatDateLong(day.date);
    title.append(eyebrow, h3);
    const count = document.createElement('span'); count.className = 'timeline-day-count'; count.textContent = `${day.items.length} điểm`;
    header.append(title, count);
    const events = document.createElement('div'); events.className = 'timeline-events';
    events.append(...day.items.map(renderEvent));
    column.append(header, events);
    return column;
  }

  function renderEvent(item) {
    const row = document.createElement('article');
    row.className = 'timeline-event'; row.dataset.timelineId = item.id;
    const time = document.createElement('div'); time.className = 'timeline-event-time';
    const strong = document.createElement('strong'); strong.textContent = item.time;
    const span = document.createElement('span'); span.textContent = periodLabel(item.time);
    time.append(strong, span);
    const marker = document.createElement('span'); marker.className = 'timeline-marker'; marker.setAttribute('aria-hidden', 'true');
    const card = document.createElement('div'); card.className = 'timeline-event-card';
    const top = document.createElement('div'); top.className = 'timeline-event-top';
    const main = document.createElement('div'); main.className = 'timeline-main';
    const h = document.createElement('h4'); h.textContent = item.title;
    const meta = document.createElement('p'); meta.className = 'meta'; meta.textContent = item.placeName || 'Không gắn địa điểm';
    main.append(h, meta);
    const actions = document.createElement('div'); actions.className = 'timeline-actions'; actions.append(actionButton('✎', 'Sửa', 'edit'), actionButton('×', 'Xóa', 'delete', 'danger'));
    top.append(main, actions); card.append(top);
    if (item.note) { const p = document.createElement('p'); p.className = 'timeline-note'; p.textContent = item.note; card.append(p); }
    row.append(time, marker, card);
    return row;
  }

  function populatePlaces(){const current=els.timelinePlace.value;els.timelinePlace.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Không gắn địa điểm';els.timelinePlace.append(empty);for(const p of state.places||[]){const o=document.createElement('option');o.value=p.id;o.textContent=p.name;els.timelinePlace.append(o)}els.timelinePlace.value=current}
  function open(item=null){els.timelineForm.reset();els.timelineMessage.textContent='';els.timelineId.value=item?.id||'';els.timelineDialogTitle.textContent=item?'Sửa lịch trình':'Thêm lịch trình';populatePlaces();if(item){els.timelineDate.value=item.date;els.timelineTime.value=item.time;els.timelineTitle.value=item.title;els.timelinePlace.value=item.placeId||'';els.timelineNote.value=item.note||'';}else{els.timelineDate.value=activeDate||new Date().toISOString().slice(0,10);els.timelineTime.value='08:00';}els.timelineDialog.showModal();setTimeout(()=>els.timelineTitle.focus(),40)}
  async function save(event){event.preventDefault();els.timelineMessage.textContent='';const repo=getRepository();const existing=state.timeline?.find(x=>x.id===els.timelineId.value);const place=(state.places||[]).find(p=>p.id===els.timelinePlace.value);const input=sanitizeTimelineItem({id:els.timelineId.value||(repo&&crypto.randomUUID?crypto.randomUUID():undefined),date:els.timelineDate.value,time:els.timelineTime.value,title:els.timelineTitle.value,placeId:els.timelinePlace.value,placeName:place?.name||'',note:els.timelineNote.value,createdAt:existing?.createdAt});const errors=validateTimelineItem(input);if(errors.length){els.timelineMessage.textContent=errors[0];return}setBusy(els.saveTimelineBtn,true,'Đang lưu…');try{const saved=repo?await repo.saveTimelineItem(input):input;state.timeline||=[];const idx=state.timeline.findIndex(x=>x.id===saved.id);if(idx>=0)state.timeline[idx]=saved;else state.timeline.push(saved);activeDate=saved.date;persistState(state);render();els.timelineDialog.close();toast('Đã lưu lịch trình.')}catch(error){trace('error','TIMELINE_SAVE_FAILED',error.message,errorDetails(error));els.timelineMessage.textContent=userErrorMessage(error,'Không lưu được lịch trình. Vui lòng thử lại.')}finally{setBusy(els.saveTimelineBtn,false,'Lưu lịch trình')}}
  async function action(event){const nav=event.target.closest('[data-timeline-nav]');if(nav){navigate(nav);return}const btn=event.target.closest('[data-timeline-action]');if(!btn)return;const item=state.timeline?.find(x=>x.id===btn.closest('[data-timeline-id]')?.dataset.timelineId);if(!item)return;if(btn.dataset.timelineAction==='edit')return open(item);if(btn.dataset.timelineAction==='delete'&&confirm(`Xóa “${item.title}”?`)){try{const repo=getRepository();if(repo)await repo.deleteTimelineItem(item.id);state.timeline=state.timeline.filter(x=>x.id!==item.id);persistState(state);render()}catch(error){trace('error','TIMELINE_DELETE_FAILED',error.message,errorDetails(error));toast(userErrorMessage(error,'Không xóa được lịch trình. Vui lòng thử lại.'))}}}
  function navigate(control){const dates=groupTimelineDays(state.timeline||[]).map((day)=>day.date);if(!dates.length)return;const index=Math.max(0,dates.indexOf(activeDate));if(control.dataset.timelineNav==='date')activeDate=control.dataset.timelineDate||activeDate;else if(control.dataset.timelineNav==='prev')activeDate=dates[Math.max(0,index-1)];else if(control.dataset.timelineNav==='next')activeDate=dates[Math.min(dates.length-1,index+1)];render()}
  return {render,open,save,action};
}

function navButton(text,label,action,disabled){const b=document.createElement('button');b.type='button';b.className='timeline-nav-btn';b.dataset.timelineNav=action;b.setAttribute('aria-label',label);b.title=label;b.disabled=disabled;b.textContent=text;return b}
function periodLabel(time='00:00'){const h=Number(time.slice(0,2));if(h<11)return'Sáng';if(h<13)return'Trưa';if(h<18)return'Chiều';return'Tối'}
function actionButton(text,label,action,extra=''){const b=document.createElement('button');b.type='button';b.className=`icon-btn ${extra}`.trim();b.dataset.timelineAction=action;b.setAttribute('aria-label',label);b.textContent=text;return b}
function parseLocalDate(date){return new Date(`${date}T00:00:00`)}
function formatDate(date){try{return new Intl.DateTimeFormat('vi-VN',{weekday:'short',day:'2-digit',month:'2-digit'}).format(parseLocalDate(date))}catch{return date}}
function formatDateLong(date){try{return new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}).format(parseLocalDate(date))}catch{return date}}
function formatWeekday(date){try{return new Intl.DateTimeFormat('vi-VN',{weekday:'long'}).format(parseLocalDate(date))}catch{return ''}}
