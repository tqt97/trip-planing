export async function albumFileToDataUrl(file, maxDimension = 1600) {
  if (!file || !String(file.type || '').startsWith('image/')) throw new Error('File phải là hình ảnh.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Hình tối đa 5 MB.');
  const raw = await readAsDataUrl(file);
  if (file.type === 'image/gif') return raw;
  try { return await resizeImage(raw, file.type, maxDimension); } catch { return raw; }
}
function readAsDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('Không đọc được hình.'));r.readAsDataURL(file)})}
function resizeImage(src,type,maxDimension){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const scale=Math.min(1,maxDimension/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL(type==='image/png'?'image/png':'image/jpeg',.84))};img.onerror=reject;img.src=src})}
