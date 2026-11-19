import { describe, it, expect } from 'vitest';
import { emptyData, toSatang, roomLimit, validLicense, calculateBill, previousReading, sampleData, parseBackup } from './dorm';
function sampleRoom(data: ReturnType<typeof sampleData>, index: number) { const r=data.rooms[index]; if(!r)throw new Error('Missing fixture'); return r; }
describe('กฎการคำนวณหอพัก', () => {
  it('คำนวณเป็นสตางค์อย่างแม่นยำ', () => { expect(toSatang('0.29')).toBe(29); expect(toSatang('3500.50')).toBe(350050); expect(() => toSatang('1.001')).toThrow(); });
  it('ฟรี 5 ห้อง และโปร 100 ห้อง', () => { expect(roomLimit(false)).toBe(5); expect(roomLimit(true)).toBe(100); });
  it('ตรวจรหัสออฟไลน์ที่กำหนด', () => { expect(validLicense('DORM2026-PRO')).toBe(true); expect(validLicense('WRONG')).toBe(false); });
  it('ข้อมูลตัวอย่างมี 10 ห้อง', () => { expect(sampleData('2026-11').rooms).toHaveLength(10); });
  it('ดึงเลขมิเตอร์เดือนก่อนและไม่ดึงอนาคต', () => { const d = sampleData('2026-10'); const r = sampleRoom(d,0); expect(previousReading(d,r,'2026-11').water).toBe(r.water+5); expect(previousReading(d,r,'2026-09').water).toBe(r.water); });
  it('แจ้งเลขมิเตอร์ลดลง', () => { const d=sampleData('2026-11'); const r=sampleRoom(d,0); const rs=d.readings['2026-11']; const reading=rs?.[r.id]; if(!reading)throw new Error('Missing fixture'); reading.water=r.water-1; expect(calculateBill(d,r,'2026-11').valid).toBe(false); });
  it('รวมค่าเช่า น้ำ ไฟ ส่วนกลางเป็นสตางค์', () => { const d=sampleData('2026-11'); const r=sampleRoom(d,0); expect(calculateBill(d,r,'2026-11',new Date(2026,10,1)).total).toBe(441000); });
  it('คิดค่าปรับต่อวันเมื่อเลยกำหนดเดือนถัดไป', () => { const d=sampleData('2026-11'); d.settings.fine=2000; const r=sampleRoom(d,6); expect(calculateBill(d,r,'2026-11',new Date(2026,11,8)).fine).toBe(6000); });
  it('คิดค่าปรับเหมาจ่ายครั้งเดียว', () => { const d=sampleData('2026-11'); d.settings.fine=10000; d.settings.fineMode='flat'; expect(calculateBill(d,sampleRoom(d,6),'2026-11',new Date(2026,11,8)).fine).toBe(10000); });
  it('ปฏิเสธข้อมูลกู้คืนผิดรูปแบบ', () => { expect(() => parseBackup({ version: 1 })).toThrow(); expect(parseBackup(emptyData()).rooms).toEqual([]); });
});