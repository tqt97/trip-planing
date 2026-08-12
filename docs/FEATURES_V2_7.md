# V2.7 - Ảnh chuyến đi, checklist actor, defaults

## Defaults
- Radius filter mặc định: `Tất cả` (`9999`) cho Places và Radar.
- Số người mặc định để chia chi phí: `4`.

## Ảnh & link tham khảo
Khu ảnh dùng chung cho ảnh/link tham khảo của chuyến đi.
- Status: `reference`, `want`, `visited`.
- Có thể upload ảnh hoặc chỉ lưu ghi chú/link.
- Mobile: horizontal scroll + scroll snap, card ~78vw.
- Desktop: horizontal gallery nhiều card.
- Click card mở lightbox xem lớn.
- Local: ảnh được nén/lưu data URL trong localStorage.
- Prod: ảnh upload Supabase Storage bucket `trip-album`, metadata trong `trip_album_items`.

## Checklist completion actor
Checklist lưu `completed_by` và `completed_at`.
- Khi user check done, trigger DB gán `completed_by = auth.uid()`.
- UI hiện avatar chữ cái đầu email của người hoàn thành.
- Public checklist: thành viên Trip cùng edit/check.
- Private checklist: chỉ creator đọc/sửa.

## Production migration
Database đã chạy v2.6 chỉ cần chạy:
`supabase/migrations/003_album_checklist_completion.sql`
