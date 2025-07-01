
import React, { useState, useEffect } from 'react';
import type { PaymentInfo } from '../types';
import { Spinner } from './Spinner';

interface DataInputFormProps {
  onSubmit: (sheetUrl: string, range: string, paymentInfo: PaymentInfo) => void;
  isLoading: boolean;
}

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
    return {}; // Return empty object if nothing saved or error
};


export function DataInputForm({ onSubmit, isLoading }: DataInputFormProps): React.ReactNode {
  const initialState = getInitialState();

  const [sheetUrl, setSheetUrl] = useState<string>(initialState.sheetUrl || 'https://docs.google.com/spreadsheets/d/1_9v2p0s4k2xQoR_C_5J6H7a8b9c0d1e2f3g4h5i6j7/edit#gid=0');
  const [range, setRange] = useState<string>(initialState.range || 'A1:K29');
  const [bankName, setBankName] = useState<string>(initialState.bankName || 'MB Bank');
  const [accountNumber, setAccountNumber] = useState<string>(initialState.accountNumber || '0123456789');
  const [accountName, setAccountName] = useState<string>(initialState.accountName || 'NGUYEN VAN A');
  const [paymentNote, setPaymentNote] = useState<string>(initialState.paymentNote || 'CK tien nha thang {thang}');

  // Persist all form settings on change
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
