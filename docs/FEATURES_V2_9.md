# Tính năng v2.9 — Timeline, Expense Settlement, PWA

## Timeline

Timeline lưu theo `ngày + giờ`, sau đó UI luôn sắp xếp tăng dần theo ngày và giờ. Mỗi mục có thể gắn với một địa điểm đã lưu và có ghi chú. Nhãn thời gian được chia Sáng / Trưa / Chiều / Tối để đọc nhanh trên mobile.

Production lưu trong bảng `trip_timeline_items` và đồng bộ Realtime. Thành viên Trip được đọc; owner/editor được thêm, sửa, xóa.

## Chốt tiền — Ai nợ ai

Mỗi khoản chi có thêm `participants`: danh sách người cùng chia khoản đó. Công thức chia đều theo từng khoản, sau đó app gom balance toàn chuyến và rút gọn thành các transfer tối thiểu kiểu `Bình → An: 120.000 ₫`.

Production lưu `expenses.participants` dưới dạng `text[]`. Các khoản cũ không có participants vẫn giữ nguyên và không bị tự suy đoán.

## PWA / Offline

App có `manifest.webmanifest`, service worker và có thể Add to Home Screen trên trình duyệt hỗ trợ PWA. Service worker cache app shell và static assets cùng origin.

Local mode tiếp tục offline hoàn toàn với localStorage. Production không cache snapshot Supabase private vào localStorage; nếu đang mở app rồi mất mạng, UI hiện tại vẫn còn trên màn hình, nhưng reload hoàn toàn khi offline sẽ không giả lập dữ liệu shared mới.

## Nâng production

Nếu database đang ở v2.8.x, chỉ cần chạy:

`supabase/migrations/005_timeline_expense_settlement.sql`

sau đó redeploy source v2.9.1. Không cần reset database.


## Timeline visual v2.9.1
- Desktop hiển thị tối đa 3 ngày gần ngày đang chọn, đặt cạnh nhau để so sánh.
- Mobile chỉ hiển thị 1 ngày active; dùng nút trước/sau để đổi ngày.
- Mỗi ngày có trục timeline dọc, mốc giờ và thứ tự sáng → trưa → chiều → tối.
