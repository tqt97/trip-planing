export function userErrorMessage(error,fallback='Có lỗi xảy ra. Vui lòng thử lại.'){
 const m=String(error?.message||error||'').toLowerCase();if(!m)return fallback;
 if(/failed to fetch|networkerror|network request|load failed|fetch failed/.test(m))return'Không thể kết nối máy chủ. Kiểm tra mạng rồi thử lại.';
 if(/jwt|token|session|not authenticated|authentication required|refresh_token/.test(m))return'Phiên đăng nhập không còn hợp lệ. Hãy đăng nhập lại.';
 if(/row-level security|permission denied|not allowed|forbidden|insufficient privilege|42501/.test(m))return'Bạn không có quyền thực hiện thao tác này.';
 if(/payload too large|413/.test(m))return'Tệp quá lớn. Hãy chọn tệp nhỏ hơn rồi thử lại.';
 return fallback;
}
