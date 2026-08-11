# Đà Lạt Nearby Planner v2.4.3

Planner mobile-first cho chuyến Đà Lạt: Places, radar quanh Home, vote, Top 6 gợi ý, gom điểm gần nhau, Expenses và Google Maps links.

## Điểm mới v2.4

Một source code, hai data provider theo môi trường:

```text
APP_ENV=local  -> localStorage, offline, không login, không tải Firebase SDK
APP_ENV=prod   -> Firebase Authentication + Cloud Firestore realtime
```

Business/UI dùng chung; Firebase được lazy-load chỉ khi production provider được chọn.

## Chạy local nhanh

```bash
npm install
cp .env.example .env.local
# giữ APP_ENV=local
npm run dev
```

Mở `http://127.0.0.1:3000`.

Local mode lưu Places + Expenses trong browser localStorage như v1. Không cần Firebase và không cần Google login.

## Production Firebase

Đọc [`docs/DEPLOY_FIREBASE_VERCEL_VI.md`](docs/DEPLOY_FIREBASE_VERCEL_VI.md).

Các biến chính:

```env
APP_ENV=prod
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=YOUR_PROJECT.firebaseapp.com
FIREBASE_PROJECT_ID=YOUR_PROJECT
FIREBASE_APP_ID=...
FIREBASE_MESSAGING_SENDER_ID=...
DEFAULT_TRIP_SLUG=dalat-2026
DEFAULT_TRIP_NAME=Đà Lạt 2026
```

Deploy Firestore Rules trước khi chia sẻ app:

```bash
npm install -g firebase-tools
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore:rules,firestore:indexes
```

## Default places

Chỉnh `data/default-places.json`. Khi Trip Firebase lần đầu được tạo và Places đang trống, owner đầu tiên sẽ tự seed danh sách này nếu `FIREBASE_AUTO_SEED_DEFAULTS=true`.

## Cấu trúc

```text
api/                         Vercel functions: config + ORS route/matrix
data/default-places.json     dữ liệu địa điểm mặc định
firebase/                    Firestore rules/indexes
src/app/                     orchestration, shell, storage, radar, UI helpers
src/config/                  UI config normalization
src/data/                    Firebase lazy client + Firebase repository
src/features/                Places / recommendations / expenses / members / diagnostics
styles/                      foundation / responsive / collaboration layers
tests/                       unit/API/repository/Firestore rule contracts
```

## Quality

```bash
npm run quality
```

Chạy lint/security, 31 tests, responsive UI gate, performance budget, build, smoke và 2.000 monkey mutations.

Chi tiết: [`docs/QUALITY_REPORT.md`](docs/QUALITY_REPORT.md).
