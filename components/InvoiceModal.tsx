import React from 'react';
import type { RoomData, PaymentInfo } from '../types';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomData: RoomData | null;
  paymentInfo: PaymentInfo | null;
}

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


export function InvoiceModal({ isOpen, onClose, roomData, paymentInfo }: InvoiceModalProps): React.ReactNode {
  if (!isOpen || !roomData || !paymentInfo) return null;

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
        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Hóa đơn Phòng {roomData['TÊN PHÒNG']}
          </h3>
          <button onClick={onClose} className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center dark:hover:bg-gray-600 dark:hover:text-white">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
          </button>
        </div>
        
        {/* Invoice Content */}
        <div className="p-6 overflow-y-auto">
          <div id="invoice-printable-area" className="bg-white p-8 sm:p-10 print:bg-white">
            {/* Invoice Header */}
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

            {/* Billing Info */}
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
            
            {/* Items Table */}
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

            {/* Payment Info */}
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

        {/* Modal Footer */}
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