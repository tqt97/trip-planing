# Đà Lạt Nearby Planner

Ứng dụng web mobile-first để cả nhóm lên kế hoạch, chọn địa điểm, quản lý lịch trình, chi tiêu, công việc và ảnh tham khảo cho chuyến đi Đà Lạt.

**Tác giả:** TuanTQ  
**Phiên bản:** 2.9.8

## Kiến trúc môi trường

```text
APP_ENV=local
└── localStorage
    ├── Không đăng nhập
    ├── Dùng offline/local dev
    └── Dữ liệu chỉ nằm trên trình duyệt hiện tại

APP_ENV=prod
└── Supabase
    ├── Google Auth
    ├── PostgreSQL + Row Level Security
    ├── Realtime
    └── Storage cho ảnh
```

Local và production dùng chung UI/domain logic, chỉ thay repository lưu trữ.

## Tính năng

### Địa điểm

- Thêm/sửa/xóa địa điểm bằng tên, địa chỉ hoặc tọa độ.
- Paste Google Maps URL để tự lấy latitude/longitude.
- Home Base cố định từ cấu hình hoặc Trip production.
- Tính quãng đường và ETA qua OpenRouteService.
- Fallback ETA tối ưu cho Đà Lạt khi ORS lỗi/chưa cấu hình.
- Filter theo bán kính, danh mục, tìm kiếm và sắp xếp.
- Phân trang configurable; mobile card compact.
- Mở Google Maps trực tiếp.
- Note, link ghi chú và ảnh địa điểm.
- Vote theo từng user.
- “Nên đi đâu tiếp?” lấy Top 6 theo vote rồi khoảng cách.
- Gom các địa điểm gần nhau.

### Radar quanh Home

- Hiển thị vị trí tương đối Bắc / Đông / Nam / Tây.
- Filter theo danh mục và bán kính.
- Click marker để mở Google Maps.
- Khoảng cách radar dùng tọa độ thực; Distance/ETA danh sách dùng routing.

### Lịch trình

- Lịch trình theo ngày và giờ.
- Tự sắp xếp từ sáng → trưa → chiều → tối.
- Desktop hiển thị tối đa 3 ngày gần nhau để so sánh.
- Mobile hiển thị 1 ngày/lần với điều hướng ngày trước/sau.
- Timeline trực quan với rail, marker và mốc giờ.
- Có thể gắn item lịch trình với địa điểm đã lưu.
- Realtime trong production.

### Chi tiêu & chốt tiền

- Thêm người trả, hạng mục, số tiền, ghi chú.
- Mặc định 4 người; có thể cấu hình số người.
- Tổng chi tiêu và trung bình/người.
- Mỗi khoản có danh sách người cùng chia.
- Tự tính settlement “Ai nợ ai” và giảm số giao dịch cần chuyển.
- Phân trang 8 khoản/trang; đổi trang tự cuộn về đầu section.

### Công việc / Checklist

- Nhóm “Chuẩn bị” và “Trong chuyến đi”.
- Public: thành viên Trip cùng xem/sửa.
- Private: chỉ người tạo xem/sửa.
- Completion theo từng user, không dùng trạng thái done chung.
- Checkbox chỉ checked với chính user hiện tại.
- Hiển thị avatar chữ cái đầu email của những người đã hoàn thành.

### Ảnh

- Lưu ảnh hoặc chỉ lưu note/link tham khảo.
- Trạng thái: Tham khảo / Muốn đi / Đã đi.
- Grid thumbnail responsive, click mở lightbox.
- Phân trang 8 item/trang.
- Local dùng data URL; production dùng Supabase Storage.
- Tự cleanup file Storage khi thay/xóa ảnh.

### Nhóm & phân quyền

- Google Login qua Supabase Auth.
- Một Trip dùng chung cho cả nhóm.
- Role: `owner`, `editor`, `viewer`.
- RLS enforce quyền tại PostgreSQL, không chỉ ẩn button frontend.
- Realtime cho Places, Expenses, Votes, Members, Checklist, Completion, Ảnh và Timeline.

### PWA / Offline

- `manifest.webmanifest` + Service Worker.
- Có thể Add to Home Screen.
- Network-first cho HTML/CSS/JS để deployment mới không bị giữ giao diện cũ.
- Cache fallback cho app shell/static asset khi mất mạng.
- Production không cache snapshot Trip/private data vào localStorage.

### Import / Export

- Export backup JSON.
- Import local state có sanitize/bounds.
- Production import merge Places, Expenses, Checklist, Ảnh và Timeline.
- Giữ backward compatibility với các state version cũ.

### UI / UX

- Mobile-first từ màn hình nhỏ đến desktop.
- Section collapse bằng click header.
- FAB thêm địa điểm, Back to top.
- Responsive modal/bottom sheet.
- SEO/meta cơ bản.
- UI config qua environment: title, subtitle, page size, filter mặc định.
- User-facing error chỉ hiển thị thông báo thân thiện; mã lỗi/trace chỉ nằm trong Nhật ký kỹ thuật.

## Chạy local

Yêu cầu Node.js 20+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Ví dụ `.env.local`:

```env
APP_ENV=local
HOME_NAME=HOME_NAME
HOME_LAT=HOME_LAT
HOME_LNG=HOME_LNG
```

Mở `http://127.0.0.1:3000` hoặc URL được dev server in ra terminal.

## Production / Vercel

Các biến tối thiểu:

```env
APP_ENV=prod
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
DEFAULT_TRIP_SLUG=your-plan

HOME_NAME=HOME_NAME
HOME_LAT=HOME_LAT
HOME_LNG=HOME_LNG
```

Nếu dùng routing:

```env
OPENROUTESERVICE_API_KEY=...
ORS_BASE_URL=https://api.heigit.org
```

Hướng dẫn đầy đủ: `docs/DEPLOY_VERCEL_SUPABASE_GOOGLE_VI.md`.

## Supabase migrations

Chạy theo thứ tự:

1. `supabase/migrations/001_v2_collaboration.sql`
2. `supabase/migrations/002_trip_features.sql`
3. `supabase/migrations/003_album_checklist_completion.sql`
4. `supabase/migrations/004_checklist_per_user_completion.sql`
5. `supabase/migrations/005_timeline_expense_settlement.sql`

Dựng database sạch có thể dùng:

```text
supabase/RESET_MIGRATE_SEED.sql
```

## Seed mặc định

Danh sách mặc định nằm tại:

```text
data/default-places.json
```

Production seed thủ công:

```bash
npm run db:seed
```

`SUPABASE_SECRET_KEY` chỉ dùng local/admin cho seed và không được đưa vào frontend.

## Cấu trúc source

```text
src/
├── app/            # bootstrap, shell, storage, PWA, bindings
├── config/         # UI/environment config
├── data/           # repository + Supabase client
└── features/
    ├── album/
    ├── checklists/
    ├── common/
    ├── diagnostics/
    ├── expenses/
    ├── members/
    ├── places/
    ├── recommendations/
    └── timeline/

styles/
├── 00-foundation.css
├── 10-responsive.css
├── 15-album.css
├── 16-trip-tools.css
└── 20-collaboration.css
```

`npm run build` ghép CSS source thành một `styles.css` production và copy asset vào `dist/`.

## Quality

Chạy toàn bộ quality gate:

```bash
npm run quality
```

Bao gồm:

```text
lint/security
unit + API + repository + RLS tests
build
UI responsive regression
performance budget
smoke test
2,000 monkey mutations
```

Tài liệu liên quan:

- `docs/ARCHITECTURE_V2_9.md`
- `docs/FEATURES_V2_9.md`
- `docs/QUALITY_REPORT.md`
- `docs/DEPLOY_VERCEL_SUPABASE_GOOGLE_VI.md`

## Bảo mật

- Không đưa `SUPABASE_SECRET_KEY` / service-role key vào browser.
- Production write permissions được enforce bằng RLS.
- Shared/private Trip state không được persist vào localStorage ở production.
- URL/note/import được sanitize trước khi lưu/render.
- Các lỗi kỹ thuật được ghi vào Diagnostics nhưng message hiển thị cho người dùng không lộ mã backend/trace.

## Tác giả

**TuanTQ**
