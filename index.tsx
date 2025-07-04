import React, { useState, useCallback, useEffect, StrictMode } from 'react';
import ReactDOM from 'react-dom/client';

// === From types.ts ===
interface RoomData {
  'TÊN PHÒNG': string;
  'TÊN': string;
  'TIỀN PHÒNG': string;
  'SỐ NGƯỜI': string;
  'ĐIỆN CŨ': string;
  'ĐIỆN MỚI': string;
  'TỔNG SỐ ĐIỆN': string;
  'TỔNG TIỀN ĐIỆN': string;
  'NƯỚC': string;
  'DV': string;
  'TỔNG TIỀN PHẢI THANH TOÁN': string;
}

interface PaymentInfo {
  bankName: string;
  accountNumber: string;
  accountName: string;
  paymentNote: string;
}

interface InvoiceData {
  roomData: RoomData;
  paymentInfo: PaymentInfo;
}


// === From utils/sheetUtils.ts ===
interface A1Range {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

function parseGidFromUrl(url: string): string {
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

function parseA1Notation(range: string): A1Range | null {
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

function getGoogleSheetDataUrl(sheetUrl: string, range: A1Range, gid: string): string | null {
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

const REQUIRED_HEADERS = Object.values(CANONICAL_HEADER_MAP);

function parseGvizJson(json: any): RoomData[] {
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
      
      if (!hasAnyValue) return null;

      return entry;
    })
    .filter((row): row is Partial<RoomData> => {
        if (!row) return false;
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


// === From components/Spinner.tsx ===
const Spinner = ({ className = 'h-5 w-5 text-white' }: { className?: string }): React.ReactNode => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);


// === From components/InvoiceModal.tsx ===
function InvoiceModal({ isOpen, onClose, roomData, paymentInfo }: { isOpen: boolean; onClose: () => void; roomData: RoomData | null; paymentInfo: PaymentInfo | null; }): React.ReactNode {
  if (!isOpen || !roomData || !paymentInfo) return null;

  const getPlainTextInvoice = (roomData: RoomData, paymentInfo: PaymentInfo): string => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const paymentNote = paymentInfo.paymentNote.replace('{thang}', `${currentMonth}`);

    const items = [
      { label: 'Tiền thuê phòng', value: roomData['TIỀN PHÒNG'] },
      { label: 'Tiền điện', value: roomData['TỔNG TIỀN ĐIỆN'], detail: `(Cũ: ${roomData['ĐIỆN CŨ']}, Mới: ${roomData['ĐIỆN MỚI']}, Dùng: ${roomData['TỔNG SỐ ĐIỆN']} kWh)` },
      { label: 'Tiền nước', value: roomData['NƯỚC'] },
      { label: 'Phí dịch vụ', value: roomData['DV'] },
    ];

    const itemsText = items
      .filter(item => item.value && item.value.trim() !== '' && item.value.trim() !== '0' && item.value.trim() !== '0 đ')
      .map((item) => {
        let line = `- ${item.label}: ${item.value}`;
        if (item.label === 'Tiền điện' && roomData['TỔNG SỐ ĐIỆN'] && roomData['TỔNG SỐ ĐIỆN'] !== '0') {
            line += ` ${item.detail}`;
        }
        return line;
    }).join('\n');

    const invoiceText = `
Chào bạn ${roomData['TÊN']},

Nhà trọ xin gửi bạn thông báo tiền nhà tháng ${currentMonth}/${currentYear} cho phòng ${roomData['TÊN PHÒNG']} (Số người: ${roomData['SỐ NGƯỜI'] || 'N/A'}).

Chi tiết các khoản phí:
${itemsText}

------------------------------------
TỔNG CỘNG THANH TOÁN: ${roomData['TỔNG TIỀN PHẢI THANH TOÁN']}
------------------------------------

Bạn vui lòng thanh toán sớm.

Thông tin chuyển khoản:
- Ngân hàng: ${paymentInfo.bankName}
- Số tài khoản: ${paymentInfo.accountNumber}
- Chủ tài khoản: ${paymentInfo.accountName}
- Nội dung: "${paymentNote}"

Cảm ơn bạn!
`;
    return invoiceText.replace(/^\s+/gm, '').trim();
  };

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const currentDate = new Date().toLocaleDateString('vi-VN');
  const paymentNote = paymentInfo.paymentNote.replace('{thang}', `${currentMonth}`);
  
  const invoiceItems = [
    { label: 'Tiền thuê phòng', value: roomData['TIỀN PHÒNG'], detail: '-' },
    { label: 'Tiền điện', value: roomData['TỔNG TIỀN ĐIỆN'], detail: `Cũ: ${roomData['ĐIỆN CŨ']} Mới: ${roomData['ĐIỆN MỚI']} (${roomData['TỔNG SỐ ĐIỆN']} kWh)` },
    { label: 'Tiền nước', value: roomData['NƯỚC'], detail: '-' },
    { label: 'Phí dịch vụ', value: roomData['DV'], detail: '-' },
  ];

  const handleCopy = () => {
    const textToCopy = getPlainTextInvoice(roomData, paymentInfo);
    navigator.clipboard.writeText(textToCopy);
    alert('Đã sao chép nội dung hóa đơn!');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 print:hidden">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Hóa đơn Phòng {roomData['TÊN PHÒNG']}
          </h3>
          <button onClick={onClose} className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center dark:hover:bg-gray-600 dark:hover:text-white">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          <div id="invoice-printable-area" className="bg-white p-8 sm:p-10 print:bg-white">
            <div className="flex justify-between items-start mb-10">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white print:text-black">HÓA ĐƠN TIỀN NHÀ</h1>
                <p className="text-gray-500 dark:text-gray-400 print:text-black">Tháng {currentMonth}/{currentYear}</p>
              </div>
              <div className="text-right">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white print:text-black">Phòng {roomData['TÊN PHÒNG']}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 print:text-black">Ngày xuất: {currentDate}</p>
              </div>
            </div>
            <div className="mb-8 grid grid-cols-2 gap-x-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 print:text-black">Gửi đến:</p>
                <p className="font-medium text-gray-900 dark:text-white print:text-black">{roomData['TÊN']}</p>
              </div>
              {roomData['SỐ NGƯỜI'] && (
                <div className="text-right">
                    <p className="text-sm text-gray-500 dark:text-gray-400 print:text-black">Số người:</p>
                    <p className="font-medium text-gray-900 dark:text-white print:text-black">{roomData['SỐ NGƯỜI']}</p>
                </div>
              )}
            </div>
            <div className="flow-root">
              <table className="min-w-full text-left">
                <thead className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th scope="col" className="py-3 pr-3 font-semibold print:text-black">Mục</th>
                    <th scope="col" className="hidden py-3 px-3 text-right font-semibold sm:table-cell print:text-black">Chi tiết</th>
                    <th scope="col" className="py-3 pl-3 text-right font-semibold print:text-black">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.map((item, index) => (
                    <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="py-4 pr-3 text-gray-700 dark:text-gray-300 print:text-black">{item.label}</td>
                      <td className="hidden py-4 px-3 text-right text-sm text-gray-500 dark:text-gray-400 sm:table-cell print:text-black">{item.detail}</td>
                      <td className="py-4 pl-3 text-right font-medium text-gray-800 dark:text-gray-200 print:text-black">{item.value || '-'}</td>
                    </tr>
  
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={2} className="hidden pt-6 pr-3 text-right font-semibold text-gray-900 dark:text-white sm:table-cell print:text-black">TỔNG CỘNG</th>
                    <th scope="row" className="pt-6 pl-3 text-left font-semibold text-gray-900 dark:text-white sm:hidden print:text-black">TỔNG CỘNG</th>
                    <td className="pt-6 pl-3 text-right font-semibold text-lg text-blue-600 dark:text-blue-400 print:text-black">{roomData['TỔNG TIỀN PHẢI THANH TOÁN']}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white print:text-black">Thông tin thanh toán</h3>
              <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="col-span-1"><dt className="text-gray-500 dark:text-gray-400 print:text-black">Ngân hàng:</dt><dd className="font-medium text-gray-900 dark:text-gray-100 print:text-black">{paymentInfo.bankName}</dd></div>
                <div className="col-span-1"><dt className="text-gray-500 dark:text-gray-400 print:text-black">Chủ tài khoản:</dt><dd className="font-medium text-gray-900 dark:text-gray-100 print:text-black">{paymentInfo.accountName}</dd></div>
                <div className="col-span-1"><dt className="text-gray-500 dark:text-gray-400 print:text-black">Số tài khoản:</dt><dd className="font-medium text-gray-900 dark:text-gray-100 print:text-black">{paymentInfo.accountNumber}</dd></div>
                <div className="col-span-1"><dt className="text-gray-500 dark:text-gray-400 print:text-black">Nội dung:</dt><dd className="font-medium text-gray-900 dark:text-gray-100 print:text-black">"{paymentNote}"</dd></div>
              </dl>
              <p className="mt-6 text-sm text-gray-500 dark:text-gray-400 print:text-black">Cảm ơn bạn đã thanh toán đúng hạn!</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end p-4 border-t dark:border-gray-700 space-x-2">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
              </svg>
              In PDF
            </button>
            <button
              onClick={handleCopy}
              className="text-white bg-green-600 hover:bg-green-700 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800"
            >
              Sao chép
            </button>
            <button 
              onClick={onClose}
              className="text-gray-500 bg-white hover:bg-gray-100 focus:ring-4 focus:ring-blue-300 rounded-lg border border-gray-200 text-sm font-medium px-5 py-2.5 hover:text-gray-900 focus:z-10 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-600"
            >
              Đóng
            </button>
        </div>
      </div>
    </div>
  );
}


// === From components/DataTable.tsx ===
function DataTable({ data, onGenerateInvoice }: { data: RoomData[]; onGenerateInvoice: (roomData: RoomData) => void; }): React.ReactNode {
  const DISPLAY_HEADERS = ['', ...REQUIRED_HEADERS];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              {DISPLAY_HEADERS.map((header, index) => (
                <th key={index} scope="col" className="px-6 py-3 whitespace-nowrap">
                  {String(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => onGenerateInvoice(row)}
                    className="font-medium text-blue-600 dark:text-blue-500 hover:underline"
                  >
                    Tạo Hóa Đơn
                  </button>
                </td>
                {REQUIRED_HEADERS.map((header, headerIndex) => (
                  <td key={`${index}-${headerIndex}`} className="px-6 py-4 whitespace-nowrap">
                    {row[header as keyof RoomData]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// === From components/DataInputForm.tsx ===
function DataInputForm({ onSubmit, isLoading }: { onSubmit: (sheetUrl: string, range: string, paymentInfo: PaymentInfo) => void; isLoading: boolean; }): React.ReactNode {
  const InputField = ({ id, label, placeholder, value, onChange, type = 'text' }: { id: string, label: string, placeholder: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, type?: string }) => (
    <div>
      <label htmlFor={id} className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">{label}</label>
      <input
        type={type}
        id={id}
        value={value}
        onChange={onChange}
        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
        placeholder={placeholder}
        required
      />
    </div>
  );

  const SETTINGS_KEY = 'invoiceGeneratorSettings';

  const getInitialState = () => {
    try {
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) return JSON.parse(saved);
    } catch (e) {
        console.error("Could not parse settings from localStorage", e);
    }
    return {};
  };

  const initialState = getInitialState();

  const [sheetUrl, setSheetUrl] = useState<string>(initialState.sheetUrl || '');
  const [range, setRange] = useState<string>(initialState.range || 'A1:K29');
  const [bankName, setBankName] = useState<string>(initialState.bankName || 'MB Bank');
  const [accountNumber, setAccountNumber] = useState<string>(initialState.accountNumber || '0123456789');
  const [accountName, setAccountName] = useState<string>(initialState.accountName || 'NGUYEN VAN A');
  const [paymentNote, setPaymentNote] = useState<string>(initialState.paymentNote || 'CK tien nha thang {thang}');

  useEffect(() => {
      const settings = { sheetUrl, range, bankName, accountNumber, accountName, paymentNote };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [sheetUrl, range, bankName, accountNumber, accountName, paymentNote]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const paymentInfo: PaymentInfo = { bankName, accountNumber, accountName, paymentNote };
    onSubmit(sheetUrl, range, paymentInfo);
  };

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-md dark:bg-gray-800 dark:border-gray-700">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <InputField id="sheetUrl" label="Link Google Sheet" placeholder="https://docs.google.com/spreadsheets/d/..." value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              Mẹo: Để chọn một trang tính cụ thể, hãy nhấn vào tab của nó trong Google Sheet và sao chép URL đầy đủ từ thanh địa chỉ.
            </p>
          </div>
          <InputField id="range" label="Vùng dữ liệu (vd: A1:K29)" placeholder="A1:K29" value={range} onChange={(e) => setRange(e.target.value)} />
        </div>
        
        <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Thông tin thanh toán</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <InputField id="bankName" label="Tên ngân hàng" placeholder="Vietcombank" value={bankName} onChange={(e) => setBankName(e.target.value)} />
                <InputField id="accountNumber" label="Số tài khoản" placeholder="0123456789" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
                <InputField id="accountName" label="Chủ tài khoản" placeholder="NGUYEN VAN A" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
            </div>
        </div>

        <div>
           <InputField id="paymentNote" label="Nội dung chuyển khoản" placeholder="CK tien nha thang {thang}" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Ghi chú: Bạn có thể dùng <code className="font-mono bg-gray-200 dark:bg-gray-600 rounded px-1 py-0.5 text-gray-800 dark:text-gray-200">{'{thang}'}</code> để tự động điền tháng hiện tại.
            </p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center justify-center text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? <><Spinner className="h-5 w-5 -ml-1 mr-2" /> <span >Đang tải...</span></> : 'Lấy Dữ Liệu'}
          </button>
        </div>
      </form>
    </div>
  );
}


// === From App.tsx ===
function App(): React.ReactNode {
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [tableData, setTableData] = useState<RoomData[] | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const handleFormSubmit = useCallback(async (sheetUrl: string, rangeStr: string, pInfo: PaymentInfo) => {
    setIsLoadingData(true);
    setError(null);
    setTableData(null);

    const gid = parseGidFromUrl(sheetUrl);

    const range = parseA1Notation(rangeStr);
    if (!range) {
        setError(`Định dạng vùng dữ liệu '${rangeStr}' không hợp lệ. Vui lòng dùng định dạng như 'A1:K29'.`);
        setIsLoadingData(false);
        return;
    }

    const dataUrl = getGoogleSheetDataUrl(sheetUrl, range, gid);
    if (!dataUrl) {
      setError('Link Google Sheet không hợp lệ. Vui lòng kiểm tra lại.');
      setIsLoadingData(false);
      return;
    }
    
    setPaymentInfo(pInfo);

    try {
      const response = await fetch(dataUrl);
      if (!response.ok) {
        if (response.status === 404 || response.status === 400) {
             throw new Error(`Không thể tải dữ liệu (lỗi ${response.status}). Vui lòng kiểm tra lại:\n1. Link Google Sheet có chính xác không.\n2. Vùng dữ liệu (vd: A1:K29) có hợp lệ không.\n3. Quyền truy cập của Sheet đã được đặt là 'Bất kỳ ai có đường liên kết'.\n\n💡 Mẹo: Để đảm bảo hoạt động, hãy thử 'Tệp' > 'Chia sẻ' > 'Xuất bản lên web'.`);
        }
        throw new Error(`Không thể tải dữ liệu. Mã lỗi: ${response.status}`);
      }
      
      const responseText = await response.text();
      
      const jsonpRegex = /google\.visualization\.Query\.setResponse\(([\s\S]*)\)/;
      const match = responseText.match(jsonpRegex);

      if (!match || !match[1]) {
        throw new Error("Phản hồi không hợp lệ từ Google. Vui lòng kiểm tra lại Link và quyền truy cập của Sheet.");
      }

      const jsonString = match[1];
      const jsonData = JSON.parse(jsonString);

      if (jsonData.status === 'error') {
        const errorMessage = jsonData.errors?.map((e: any) => e.detailed_message || e.message).join('\n') || 'Lỗi không xác định từ Google API.';
        throw new Error(`Lỗi từ Google Sheets:\n${errorMessage}`);
      }
      
      const parsedData = parseGvizJson(jsonData);

      if (parsedData.length === 0) {
        setError("Không tìm thấy dữ liệu có thể xử lý trong vùng bạn chọn. Hãy đảm bảo vùng dữ liệu không bị trống và có các cột cần thiết.");
      } else {
        setTableData(parsedData);
      }

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Đã có lỗi không xác định xảy ra.';
      if (e instanceof SyntaxError) {
        setError("Lỗi phân tích dữ liệu: Phản hồi từ Google không phải là JSON hợp lệ. Vui lòng kiểm tra lại link, vùng dữ liệu và quyền truy cập của Sheet.");
      } else {
        setError(errorMessage);
      }
      console.error(e);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  const handleGenerateInvoice = useCallback((roomData: RoomData) => {
    if (!paymentInfo) {
      setError('Vui lòng nhập thông tin thanh toán trước.');
      return;
    }
    
    setSelectedRoom(roomData);
    setIsModalOpen(true);
    setError(null);

  }, [paymentInfo]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRoom(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-10 print:hidden">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-teal-400">
            Trình Tạo Hóa Đơn Tiền Trọ
          </h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
            Tự động tạo hóa đơn từ Google Sheet một cách nhanh chóng và chính xác.
          </p>
        </header>
        
        <main className="print:hidden">
          <DataInputForm onSubmit={handleFormSubmit} isLoading={isLoadingData} />

          {isLoadingData && (
            <div className="mt-8 flex justify-center">
              <Spinner className="h-8 w-8 text-blue-500" />
            </div>
          )}
          
          {error && (
            <div className="mt-8 text-center p-4 bg-red-100 dark:bg-red-900/20 border border-red-400 text-red-700 dark:text-red-300 rounded-lg whitespace-pre-line">
              {error}
            </div>
          )}

          {tableData && (
            <div className="mt-12">
              <DataTable data={tableData} onGenerateInvoice={handleGenerateInvoice} />
            </div>
          )}
        </main>
      </div>
      
      <InvoiceModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        roomData={selectedRoom}
        paymentInfo={paymentInfo}
      />
    </div>
  );
}


// === Original index.tsx entry point ===
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);