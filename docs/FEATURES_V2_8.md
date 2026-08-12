# Tính năng v2.8 - Checklist hoàn thành theo từng người

## Behavior mới

- Mỗi checklist có thể được nhiều thành viên đánh dấu hoàn thành độc lập.
- Checkbox chỉ hiện checked khi chính user hiện tại đã hoàn thành.
- Completion của các thành viên khác được hiển thị bằng nhóm avatar chữ cái đầu email.
- Public checklist: mọi thành viên Trip có thể tự check/uncheck trạng thái của chính mình.
- Private checklist: chỉ người tạo nhìn thấy và thao tác completion.

## Database

Migration `004_checklist_per_user_completion.sql` tạo bảng `checklist_completions` với khóa chính `(checklist_id, user_id)`. RLS chỉ cho user insert/delete record của chính mình.

Dữ liệu completion legacy từ `checklists.done/completed_by` được migrate tự động. Các cột legacy được giữ lại để migration an toàn nhưng frontend không còn dùng làm source of truth.
