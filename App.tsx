
import React, { useState, useCallback } from 'react';
import { DataInputForm } from './components/DataInputForm';
import { DataTable } from './components/DataTable';
import { InvoiceModal } from './components/InvoiceModal';
import { Spinner } from './components/Spinner';
import type { RoomData, PaymentInfo } from './types';
import { getGoogleSheetDataUrl, parseGvizJson, parseA1Notation, parseGidFromUrl } from './utils/sheetUtils';

export default function App(): React.ReactNode {
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