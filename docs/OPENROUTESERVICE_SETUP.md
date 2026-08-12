# openrouteservice setup (free plan)

Đà Lạt Nearby Planner v1.2 dùng **OpenStreetMap data + openrouteservice/HeiGIT APIs** thay cho Google Maps trong luồng mặc định.

## 1. Tạo tài khoản và API key

1. Mở trang openrouteservice / HeiGIT account.
2. Đăng ký tài khoản và xác nhận email.
3. Vào dashboard/API keys và tạo một key cho openrouteservice.
4. Không commit key vào Git và không đặt key trong JavaScript phía browser.

Tài liệu API chính thức: https://openrouteservice.org/dev/

## 2. Cấu hình local

Tại root project:

```bash
cp .env.example .env.local
```

Sửa `.env.local`:

```bash
OPENROUTESERVICE_API_KEY=your_real_key
ORS_BASE_URL=https://api.heigit.org
```

`ORS_BASE_URL` mặc định đã là `https://api.heigit.org`; biến này tồn tại để dễ proxy/self-host về sau.

## 3. Chạy local

Yêu cầu Node.js >= 20:

```bash
npm install
npm run dev
```

Mở:

```text
http://127.0.0.1:3000
```

Terminal sẽ báo `openrouteservice API key: loaded` nếu `.env.local` được đọc thành công.

## 4. API app sử dụng

Browser không gọi HeiGIT trực tiếp. Browser gọi server của app:

- `POST /api/geocode` → `https://api.heigit.org/pelias/v1/search`
- `POST /api/route` → ORS Matrix với một destination
- `POST /api/matrix` → `https://api.heigit.org/openrouteservice/v2/matrix/driving-car`

API key chỉ được Node/Vercel Function thêm vào header `Authorization`.

### Geocode test

Sau khi `npm run dev` đang chạy:

```bash
curl -sS http://127.0.0.1:3000/api/geocode \
  -H 'Content-Type: application/json' \
  -d '{"address":"Chợ Đà Lạt, Lâm Đồng"}'
```

### Matrix test

```bash
curl -sS http://127.0.0.1:3000/api/matrix \
  -H 'Content-Type: application/json' \
  -d '{"origin":{"lat":11.9404,"lng":108.4583},"destinations":[{"lat":11.9425,"lng":108.4367}]}'
```

## 5. Deploy Vercel

1. Push repo lên GitHub/GitLab/Bitbucket.
2. Import repository vào Vercel.
3. Vào `Project Settings → Environment Variables`.
4. Tạo `OPENROUTESERVICE_API_KEY` với API key thật.
5. Có thể tạo `ORS_BASE_URL=https://api.heigit.org`, hoặc bỏ qua vì app có default này.
6. Redeploy.

Không tạo biến tên `NEXT_PUBLIC_OPENROUTESERVICE_API_KEY`; prefix `NEXT_PUBLIC_` sẽ làm secret có nguy cơ xuất hiện ở client.

## 6. Cách app tiết kiệm quota

- Geocode chỉ khi Home/place chưa có tọa độ.
- Khi đổi Home, app gửi **một Matrix request** cho tối đa 100 destinations thay vì gọi route tuần tự.
- Khi thêm/sửa một place, app dùng một Matrix request một-to-one.
- Distance/duration được lưu vào `localStorage`, không gọi provider trên mỗi render.
- Nếu provider/key/quota không sẵn sàng nhưng đã có tọa độ, app fallback sang Haversine × 1.28 và thời gian ước tính.

## 7. Endpoint mới của HeiGIT

Project dùng host mới `api.heigit.org`. Theo thông báo migration năm 2026, routing chuyển sang `/openrouteservice/...` và geocoding chuyển sang `/pelias/v1/...`. Không hard-code host cũ `api.openrouteservice.org`.

## 8. Attribution

openrouteservice sử dụng dữ liệu OpenStreetMap. Khi phát triển thêm map rendering/public product, phải giữ attribution phù hợp với OpenStreetMap/openrouteservice theo điều khoản của các dịch vụ.
