# Tính năng v2.6

## Chi tiêu chia đều

`Số người` nằm trong section Chi tiêu. `Trung bình/người = Tổng chi / Số người`. Local lưu trong state localStorage; production lưu `trips.people_count` và sync Realtime. Owner/editor được đổi cấu hình này.

## Hình + link ghi chú cho địa điểm

- `Link ghi chú`: chỉ chấp nhận `http://` hoặc `https://`.
- Local: hình được nén phía browser rồi lưu dạng data URL để test/offline.
- Production: hình upload tối đa 5 MB vào Supabase Storage bucket public `place-images`; chỉ owner/editor có quyền upload.

## Checklist

Hai loại: `prepare` (Chuẩn bị) và `during` (Trong chuyến).

- `public`: mọi thành viên Trip nhìn thấy và có thể check/sửa/xóa.
- `private`: chỉ user tạo item nhìn thấy và sửa/xóa.

RLS là lớp enforcement chính trong production. Checklist được thêm vào Supabase Realtime.

## Mobile scroll

Từ v2.6, Places, Expenses và Checklist không dùng vùng scroll lồng nhau trên màn hình <=820px. Trang cuộn tự nhiên để thao tác một tay dễ hơn.
