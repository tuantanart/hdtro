import React from 'react';
import type { RoomData } from '../types';
import { REQUIRED_HEADERS } from '../utils/sheetUtils';

interface DataTableProps {
  data: RoomData[];
  onGenerateInvoice: (roomData: RoomData) => void;
}

// Add an empty string at the beginning for the "Actions" column header.
const DISPLAY_HEADERS = ['', ...REQUIRED_HEADERS];

export function DataTable({ data, onGenerateInvoice }: DataTableProps): React.ReactNode {
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
                {/* Action button cell rendered first */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => onGenerateInvoice(row)}
                    className="font-medium text-blue-600 dark:text-blue-500 hover:underline"
                  >
                    Tạo Hóa Đơn
                  </button>
                </td>
                {/* Data cells rendered after */}
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
