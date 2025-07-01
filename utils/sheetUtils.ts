
import type { RoomData } from './types';

export interface A1Range {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export function parseGidFromUrl(url: string): string {
  const match = url.match(/[#&]gid=([0-9]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return '0'; // Default to the first sheet if no GID is found
}

function colA1ToIndex(col: string): number {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + (col.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return index - 1;
}

function indexToA1Col(index: number): string {
  let col = '';
  let tempIndex = index + 1;
  while (tempIndex > 0) {
    const rem = tempIndex % 26;
    if (rem === 0) {
      col = 'Z' + col;
      tempIndex = Math.floor(tempIndex / 26) - 1;
    } else {
      col = String.fromCharCode(rem - 1 + 'A'.charCodeAt(0)) + col;
      tempIndex = Math.floor(tempIndex / 26);
    }
  }
  return col;
}

export function parseA1Notation(range: string): A1Range | null {
  const rangeRegex = /^([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)$/i;
  const match = range.match(rangeRegex);

  if (!match) return null;

  const [, startColStr, startRowStr, endColStr, endRowStr] = match;

  return {
    startRow: parseInt(startRowStr, 10) - 1,
    startCol: colA1ToIndex(startColStr.toUpperCase()),
    endRow: parseInt(endRowStr, 10) - 1,
    endCol: colA1ToIndex(endColStr.toUpperCase()),
  };
}

export function getGoogleSheetDataUrl(sheetUrl: string, range: A1Range, gid: string): string | null {
  const idRegex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
  const idMatch = sheetUrl.match(idRegex);

  if (idMatch && idMatch[1]) {
    const sheetId = idMatch[1];
    
    const columns = [];
    for (let i = range.startCol; i <= range.endCol; i++) {
      columns.push(indexToA1Col(i));
    }
    
    const query = `select ${columns.join(',')} limit ${range.endRow - range.startRow + 1} offset ${range.startRow}`;
    const encodedQuery = encodeURIComponent(query);
    
    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}&tq=${encodedQuery}`;
  }

  return null;
}

function normalizeHeader(str: string): string {
  if (typeof str !== 'string') return String(str);
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/[\n\r]+/g, ' ')
    .replace(/"/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const CANONICAL_HEADER_MAP: { [key: string]: keyof RoomData } = {
  'TEN PHONG': 'TÊN PHÒNG',
  'TEN': 'TÊN',
  'TIEN PHONG': 'TIỀN PHÒNG',
  'SO NGUOI': 'SỐ NGƯỜI',
  'DIEN CU': 'ĐIỆN CŨ',
  'DIEN MOI': 'ĐIỆN MỚI',
  'TONG SO DIEN': 'TỔNG SỐ ĐIỆN',
  'TONG TIEN DIEN': 'TỔNG TIỀN ĐIỆN',
  'NUOC': 'NƯỚC',
  'DV': 'DV',
  'TONG TIEN PHAI THANH TOAN': 'TỔNG TIỀN PHẢI THANH TOÁN',
};

export const REQUIRED_HEADERS = Object.values(CANONICAL_HEADER_MAP);

export function parseGvizJson(json: any): RoomData[] {
  if (!json || !json.table || !json.table.cols || !json.table.rows) {
    if (json && json.errors) {
      const errorMessages = json.errors.map((e: any) => e.detailed_message).join(', ');
      throw new Error(`Lỗi từ Google Sheets: ${errorMessages}`);
    }
    return [];
  }
  
  const sheetHeaders: string[] = json.table.cols.map((col: any) => col.label || '');

  const headerMapping: (keyof RoomData | null)[] = sheetHeaders.map(sheetHeader => {
    const normalized = normalizeHeader(sheetHeader);
    return CANONICAL_HEADER_MAP[normalized] || null;
  });

  const foundHeaders = headerMapping.filter(h => h !== null);
  if (foundHeaders.length < 3) { // Heuristic check
    throw new Error("Không tìm thấy các tiêu đề cột cần thiết (vd: 'TÊN PHÒNG', 'TÊN') trong vùng dữ liệu bạn đã chọn. Vui lòng kiểm tra lại vùng dữ liệu có bao gồm hàng tiêu đề không.");
  }
  
  const dataRows = json.table.rows;

  return dataRows
    .map((rowObj: any): Partial<RoomData> | null => {
      if (!rowObj || !rowObj.c) return null;

      const values = rowObj.c.map((cell: any) => {
        if (cell === null) return '';
        // Prioritize formatted value 'f', fallback to raw value 'v'
        return cell.f ?? cell.v ?? '';
      });
      
      const entry: Partial<RoomData> = {};
      let hasAnyValue = false;
      headerMapping.forEach((canonicalKey, index) => {
        if (canonicalKey && index < values.length) {
          const value = String(values[index]).trim();
          entry[canonicalKey] = value;
          if(value !== '') hasAnyValue = true;
        }
      });
      
      // If the row is completely empty, discard it
      if (!hasAnyValue) return null;

      return entry;
    })
    .filter((row): row is Partial<RoomData> => {
        if (!row) return false;
        // Ensure at least one key identifier is present and not empty
        const hasIdentifier = (row['TÊN PHÒNG'] && row['TÊN PHÒNG'].trim() !== '') || (row['TÊN'] && row['TÊN'].trim() !== '');
        return hasIdentifier;
    })
    .map((row: Partial<RoomData>) => {
      const completeRow: any = {};
      REQUIRED_HEADERS.forEach(header => {
        completeRow[header] = row[header] || '';
      });
      return completeRow as RoomData;
    });
}
