import { sanitizePlace } from '../core.js';

const DEMO_PLACES = [
  ['Bánh căn Nhà Chung', '13 Nhà Chung, Đà Lạt', 'food', 'must', 11.9394, 108.4369],
  ['Ga Đà Lạt', '1 Quang Trung, Đà Lạt', 'attraction', 'want', 11.9414, 108.4547],
  ['Chợ Đà Lạt', 'Nguyễn Thị Minh Khai, Đà Lạt', 'shopping', 'want', 11.9425, 108.4367]
];

export function createDemoPlaces() {
  return DEMO_PLACES.map(([name, address, category, priority, lat, lng]) =>
    sanitizePlace({ name, address, category, priority, lat, lng, source: 'manual' })
  );
}
