import { z } from 'zod';

export type Room = { id: string; number: string; tenant: string; rent: number; water: number; electric: number };
export type Reading = { water: number; electric: number; paid: boolean; paidAt?: string | undefined; issued?: boolean | undefined };
export type Settings = { name: string; address: string; phone: string; waterRate: number; electricRate: number; common: number; fine: number; fineMode: 'daily' | 'flat'; dueDay: number; bank: string; qr: string };
export type DormData = { version: 1; settings: Settings; rooms: Room[]; readings: Record<string, Record<string, Reading>>; pro: boolean; demo: boolean };
export const STORAGE_KEY = 'offline-dorm-manager-v1';
export const money = (satang: number) => (satang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function toSatang(value: string | number) {
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('กรุณากรอกจำนวนเงินเป็นตัวเลข ไม่เกิน 2 ตำแหน่งทศนิยม');
  const [whole, fraction = ''] = text.split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(result)) throw new Error('จำนวนเงินสูงเกินไป');
  return result;
}
export const roomLimit = (pro: boolean) => pro ? 100 : 5;
export const validLicense = (key: string) => key.trim().toUpperCase() === 'DORM2026-PRO';
export function emptyData(): DormData {
  return { version: 1, pro: false, demo: false, rooms: [], readings: {}, settings: { name: 'หอพักของฉัน', address: '', phone: '', waterRate: 1800, electricRate: 800, common: 0, fine: 0, fineMode: 'daily', dueDay: 5, bank: '', qr: '' } };
}
export function previousReading(data: DormData, room: Room, month: string) {
  const prior = Object.keys(data.readings).filter(m => m < month && data.readings[m]?.[room.id]?.issued).sort().at(-1);
  const reading = prior ? data.readings[prior]?.[room.id] : undefined;
  return { water: reading?.water ?? room.water, electric: reading?.electric ?? room.electric };
}
export function dueDate(month: string, day: number) {
  const [y = 2026, m = 1] = month.split('-').map(Number);
  return new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
}
export function calculateBill(data: DormData, room: Room, month: string, now = new Date()) {
  const previous = previousReading(data, room, month);
  const reading = data.readings[month]?.[room.id];
  const water = (reading?.water ?? previous.water) - previous.water;
  const electric = (reading?.electric ?? previous.electric) - previous.electric;
  const due = dueDate(month, data.settings.dueDay);
  const paidDate = reading?.paidAt ? new Date(reading.paidAt) : now;
  const end = new Date(paidDate.getFullYear(), paidDate.getMonth(), paidDate.getDate());
  const days = Math.max(0, Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(due.getFullYear(), due.getMonth(), due.getDate())) / 86400000));
  const fine = reading?.issued && days > 0 ? data.settings.fine * (data.settings.fineMode === 'daily' ? days : 1) : 0;
  const waterCost = water * data.settings.waterRate;
  const electricCost = electric * data.settings.electricRate;
  const status: 'paid' | 'overdue' | 'pending' = reading?.paid ? 'paid' : reading?.issued && days > 0 ? 'overdue' : 'pending';
  return { previous, reading, water, electric, waterCost, electricCost, fine, due, days, valid: water >= 0 && electric >= 0, total: room.rent + waterCost + electricCost + data.settings.common + fine, status };
}
export function sampleData(month: string): DormData {
  const data = emptyData();
  data.demo = true;
  data.settings = { ...data.settings, name: 'หอพักสุขใจ', address: '128 ซอยประชาอุทิศ 12 แขวงทุ่งครุ เขตทุ่งครุ กรุงเทพฯ 10140', phone: '081-234-5678', common: 10000, bank: 'ธนาคารกสิกรไทย · 123-4-56789-0 · สุขใจ ใจดี' };
  const names = ['กมลชนก ใจดี', 'ธนกร พงษ์สุข', 'พรทิพย์ แสงทอง', 'ณัฐวุฒิ บุญมี', 'วิภาดา รัตนชัย', 'กิตติพงษ์ วงศ์ดี', 'สุภาวดี มีสุข', 'พีรพล ตั้งใจ', 'อรทัย จันทร์งาม', 'วรพล สุขสวัสดิ์'];
  data.rooms = names.map((tenant, i) => ({ id: `demo-${i}`, number: `${i < 5 ? 1 : 2}0${i % 5 + 1}`, tenant, rent: (i < 5 ? 3500 : 4000) * 100, water: 120 + i * 32, electric: 1250 + i * 115 }));
  data.readings[month] = Object.fromEntries(data.rooms.map((r, i) => [r.id, { water: r.water + 5 + i % 4, electric: r.electric + 90 + i * 9, paid: i < 6, issued: true, ...(i < 6 ? { paidAt: dueDate(month, 5).toISOString() } : {}) }]));
  return data;
}
const integer = z.number().int().nonnegative().max(1000000000);
const roomSchema = z.object({ id: z.string().min(1), number: z.string().min(1).max(30), tenant: z.string().max(200), rent: integer, water: integer, electric: integer });
const schema = z.object({ version: z.literal(1), pro: z.boolean(), demo: z.boolean(), settings: z.object({ name: z.string().min(1).max(200), address: z.string().max(2000), phone: z.string().max(50), waterRate: integer, electricRate: integer, common: integer, fine: integer, fineMode: z.enum(['daily', 'flat']), dueDay: z.number().int().min(1).max(28), bank: z.string().max(1000), qr: z.string().max(3000000).refine(v => !v || /^data:image\/(png|jpeg|webp);base64,/.test(v)) }), rooms: z.array(roomSchema).max(100), readings: z.record(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), z.record(z.object({ water: integer, electric: integer, paid: z.boolean(), paidAt: z.string().datetime().optional(), issued: z.boolean().optional() }))) });
export function parseBackup(input: unknown): DormData {
  const data = schema.parse(input);
  if (new Set(data.rooms.map(r => r.id)).size !== data.rooms.length || new Set(data.rooms.map(r => r.number)).size !== data.rooms.length) throw new Error('ข้อมูลห้องซ้ำกัน');
  if (!data.pro && !data.demo && data.rooms.length > 5) throw new Error('ข้อมูลเกินขีดจำกัด 5 ห้อง');
  return data;
}
export function monthLabel(month: string) { const [year = 2026, m = 1] = month.split('-').map(Number); return `${['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'][m - 1]} ${year + 543}`; }
export function downloadBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }