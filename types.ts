
export interface RoomData {
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

export interface PaymentInfo {
  bankName: string;
  accountNumber: string;
  accountName: string;
  paymentNote: string;
}

export interface InvoiceData {
  roomData: RoomData;
  paymentInfo: PaymentInfo;
}