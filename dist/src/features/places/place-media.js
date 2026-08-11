export function previewPlaceImage(els) {
  const file = els.placeImage.files?.[0]; if (!file) return;
  const error = validateImage(file); if (error) { els.placeMessage.textContent = error; els.placeImage.value = ''; return; }
  const url = URL.createObjectURL(file); els.placeImagePreview.src = url; els.placeImagePreview.hidden = false; els.placeImagePreview.onload = () => URL.revokeObjectURL(url);
}

export async function fileToDataUrl(file) {
  const error = validateImage(file); if (error) throw new Error(error);
  const raw = await readAsDataUrl(file);
  if (file.type === 'image/gif' || file.size <= 450 * 1024 || typeof document === 'undefined') return raw;
  try {
    const image = await loadImage(raw);
    const maxEdge = 1280;
    const ratio = Math.min(1, maxEdge / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const width = Math.max(1, Math.round(image.naturalWidth * ratio)); const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); if (!ctx) return raw;
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', .82);
  } catch { return raw; }
}

function validateImage(file) { if (!String(file?.type || '').startsWith('image/')) return 'File phải là hình ảnh.'; if (file.size > 5 * 1024 * 1024) return 'Hình tối đa 5 MB.'; return ''; }
function readAsDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = () => reject(new Error('Không đọc được hình.')); reader.readAsDataURL(file); }); }
function loadImage(src) { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Không đọc được kích thước hình.')); image.src = src; }); }
