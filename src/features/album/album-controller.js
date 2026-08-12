import { sanitizeAlbumItem, validateAlbumItem } from '../../core.js';
import { setBusy } from '../../app/ui.js';
import { userErrorMessage } from '../../app/error-message.js';
import { albumFileToDataUrl } from './album-media.js';
import { fillAlbumLightbox, renderAlbum } from './album-view.js';

export function createAlbumController({ els, state, getRepository, getCurrentUser, persistState, toast, trace, errorDetails, scrollTarget }) {
  const currentUserId = () => getCurrentUser()?.id || 'local';
  let currentPage = 1;
  const pageSize = 8;
  function render() { const page = renderAlbum(els, state.album || [], els.albumFilter?.value || 'all', currentPage, pageSize); currentPage = page.currentPage; }
  function resetPage() { currentPage = 1; render(); }
  function changePage(next) { const previous=currentPage; currentPage=next; render(); if(currentPage!==previous) scrollTarget?.scrollIntoView({behavior:'smooth',block:'start'}); }
  function open(item = null) {
    els.albumForm.reset(); els.albumMessage.textContent=''; els.albumId.value=item?.id||'';
    els.albumDialogTitle.textContent=item?'Sửa ảnh / link':'Thêm ảnh / link';
    if(item){els.albumTitle.value=item.title;els.albumStatus.value=item.status;els.albumNote.value=item.note||'';els.albumNoteUrl.value=item.noteUrl||''}
    els.albumDialog.showModal(); setTimeout(()=>els.albumTitle.focus(),40);
  }
  async function save(event){
    event.preventDefault(); els.albumMessage.textContent=''; const repo=getRepository(); const existing=state.album.find(x=>x.id===els.albumId.value);
    const id=els.albumId.value || (repo && crypto.randomUUID ? crypto.randomUUID() : undefined);
    const previousImageUrl=existing?.imageUrl||''; let imageUrl=previousImageUrl; let uploadedImageUrl=''; const file=els.albumImage.files?.[0];
    setBusy(els.saveAlbumBtn,true,'Đang lưu…');
    try{
      if(file){imageUrl=repo?await repo.uploadAlbumImage(file,id):await albumFileToDataUrl(file);uploadedImageUrl=repo?imageUrl:''}
      const input=sanitizeAlbumItem({id,title:els.albumTitle.value,status:els.albumStatus.value,note:els.albumNote.value,noteUrl:els.albumNoteUrl.value,imageUrl,createdBy:existing?.createdBy||currentUserId(),createdAt:existing?.createdAt});
      const errors=validateAlbumItem(input); if(errors.length){els.albumMessage.textContent=errors[0];if(uploadedImageUrl)await repo?.deleteAlbumImage(uploadedImageUrl).catch(()=>{});return}
      const saved=repo?await repo.saveAlbumItem(input):input; const idx=state.album.findIndex(x=>x.id===saved.id);if(idx>=0)state.album[idx]=saved;else state.album.push(saved);
      if(repo&&uploadedImageUrl&&previousImageUrl&&previousImageUrl!==uploadedImageUrl)repo.deleteAlbumImage(previousImageUrl).catch(error=>trace('warn','ALBUM_OLD_IMAGE_CLEANUP_FAILED',error.message,errorDetails(error)));
      persistState(state); currentPage=1; render(); els.albumDialog.close(); toast('Đã lưu ảnh / link tham khảo.');
    }catch(error){if(repo&&uploadedImageUrl)await repo.deleteAlbumImage(uploadedImageUrl).catch(()=>{});trace('error','ALBUM_SAVE_FAILED',error.message,errorDetails(error));els.albumMessage.textContent=userErrorMessage(error,'Không lưu được ảnh. Vui lòng thử lại.')}
    finally{setBusy(els.saveAlbumBtn,false,'Lưu')}
  }
  async function action(event){const btn=event.target.closest('[data-album-action]');if(!btn)return;const card=btn.closest('[data-album-id]');const item=state.album.find(x=>x.id===card?.dataset.albumId);if(!item)return;const repo=getRepository();if(btn.dataset.albumAction==='view'){fillAlbumLightbox(els,item);els.albumLightbox.showModal();return}if(btn.dataset.albumAction==='edit')return open(item);if(btn.dataset.albumAction==='delete'&&confirm(`Xóa “${item.title}” khỏi mục ảnh?`)){try{if(repo){await repo.deleteAlbumItem(item.id);if(item.imageUrl)repo.deleteAlbumImage(item.imageUrl).catch(error=>trace('warn','ALBUM_IMAGE_CLEANUP_FAILED',error.message,errorDetails(error)))}state.album=state.album.filter(x=>x.id!==item.id);persistState(state);render();toast('Đã xóa ảnh / link.')}catch(error){trace('error','ALBUM_DELETE_FAILED',error.message,errorDetails(error));toast(userErrorMessage(error,'Không xóa được ảnh. Vui lòng thử lại.'))}}}
  return { render, resetPage, changePage, open, save, action };
}
