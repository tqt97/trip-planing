import{sanitizeTripSettings}from'../../core.js';
import{userErrorMessage}from'../../app/error-message.js';
import{renderExpenses}from'./expense-view.js';
export function createExpensePager({els,state,pageSize=8,scrollTarget,getRepository,canEditShared,persistState,toast,trace,errorDetails}){
 let currentPage=1;
 const render=()=>{const p=renderExpenses(els,state.expenses||[],state.tripSettings?.peopleCount||4,currentPage,pageSize);currentPage=p.currentPage};
 const reset=()=>{currentPage=1;render()};
 const changePage=next=>{const old=currentPage;currentPage=next;render();if(currentPage!==old)scrollTarget?.scrollIntoView({behavior:'smooth',block:'start'})};
 async function changePeopleCount(){const next=sanitizeTripSettings({peopleCount:els.peopleCount.value}),old=state.tripSettings.peopleCount;state.tripSettings=next;render();persistState();const repo=getRepository?.();if(!repo)return;if(!canEditShared?.()){state.tripSettings.peopleCount=old;render();toast?.('Viewer không thể đổi số người.');return}try{await repo.updatePeopleCount(next.peopleCount);toast?.(`Đã đặt ${next.peopleCount} người để chia chi phí.`)}catch(e){state.tripSettings.peopleCount=old;render();trace?.('error','PEOPLE_COUNT_SAVE_FAILED',e.message,errorDetails?.(e));toast?.(userErrorMessage(e,'Không lưu được số người. Vui lòng thử lại.'))}}
 function bind(){els.expensePrevPageBtn?.addEventListener('click',()=>changePage(currentPage-1));els.expenseNextPageBtn?.addEventListener('click',()=>changePage(currentPage+1));els.expensePageNumbers?.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)changePage(Number(b.dataset.page))});els.peopleCount?.addEventListener('change',changePeopleCount)}
 return{bind,render,reset,changePage,changePeopleCount};
}
