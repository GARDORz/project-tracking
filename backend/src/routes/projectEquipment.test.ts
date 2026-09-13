import { describe, it, expect } from 'vitest'
import {
  normalizeHeader,
  describeEquipment,
  HEADER_ALIASES,
} from './projectEquipment.js'

describe('normalizeHeader', () => {
  it('lowercases and strips anything but letters/digits', () => {
    expect(normalizeHeader('Brand')).toBe('brand')
    expect(normalizeHeader('Serial No.')).toBe('serialno')
    expect(normalizeHeader('  Model  ')).toBe('model')
    expect(normalizeHeader('S/N')).toBe('sn')
  })

  it('treats header variants that only differ in punctuation/case as identical', () => {
    expect(normalizeHeader('Serial No.')).toBe(normalizeHeader('serial_no'))
  })
})

describe('HEADER_ALIASES (Excel import column matching)', () => {
  it('maps every known alias to the field the import route expects', () => {
    expect(HEADER_ALIASES[normalizeHeader('Brand')]).toBe('brand')
    expect(HEADER_ALIASES[normalizeHeader('Maker')]).toBe('brand')
    expect(HEADER_ALIASES[normalizeHeader('Manufacturer')]).toBe('brand')
    expect(HEADER_ALIASES[normalizeHeader('Model')]).toBe('model')
    expect(HEADER_ALIASES[normalizeHeader('Model No')]).toBe('model')
    expect(HEADER_ALIASES[normalizeHeader('Serial No.')]).toBe('serialNo')
    expect(HEADER_ALIASES[normalizeHeader('S/N')]).toBe('serialNo')
    expect(HEADER_ALIASES[normalizeHeader('Description')]).toBe('description')
    expect(HEADER_ALIASES[normalizeHeader('Remarks')]).toBe('description')
  })

  it('does not match an unrecognized header', () => {
    expect(HEADER_ALIASES[normalizeHeader('Warranty Expiry')]).toBeUndefined()
  })
})

describe('describeEquipment', () => {
  it('formats brand + model + serial when all present', () => {
    expect(
      describeEquipment({ brand: 'Dell', model: 'R740', serialNo: 'ABC123' }),
    ).toBe('Dell R740 (SN: ABC123)')
  })

  it('omits the serial suffix when there is no serial number', () => {
    expect(
      describeEquipment({ brand: 'Dell', model: 'R740', serialNo: null }),
    ).toBe('Dell R740')
  })

  it('falls back to a placeholder label when brand and model are both blank', () => {
    expect(
      describeEquipment({ brand: null, model: null, serialNo: 'XYZ' }),
    ).toBe('ไม่ระบุยี่ห้อ/รุ่น (SN: XYZ)')
    expect(
      describeEquipment({ brand: null, model: null, serialNo: null }),
    ).toBe('ไม่ระบุยี่ห้อ/รุ่น')
  })

  it('uses whichever of brand/model is present', () => {
    expect(
      describeEquipment({ brand: 'Dell', model: null, serialNo: null }),
    ).toBe('Dell')
    expect(
      describeEquipment({ brand: null, model: 'R740', serialNo: null }),
    ).toBe('R740')
  })
})
