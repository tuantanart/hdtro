
import { GoogleGenAI } from "@google/genai";
import type { InvoiceData } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY is not defined in environment variables");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

function createPrompt(data: InvoiceData): string {
  const { roomData, paymentInfo } = data;
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const paymentNote = paymentInfo.paymentNote.replace('{thang}', `${currentMonth}`);

  return `
    Là một chủ nhà trọ thân thiện, hãy soạn một thông báo hóa đơn tiền nhà tháng ${currentMonth}/${currentYear} bằng tiếng Việt để gửi cho người thuê.
    Sử dụng các thông tin chi tiết sau đây:

    **Thông tin người thuê:**
    - Tên người thuê: ${roomData['TÊN']}
    - Phòng số: ${roomData['TÊN PHÒNG']}

    **Chi tiết hóa đơn:**
    - Tiền thuê phòng: ${roomData['TIỀN PHÒNG']}
    - Tiền điện: ${roomData['TỔNG TIỀN ĐIỆN']} (Chỉ số cũ: ${roomData['ĐIỆN CŨ']}, Chỉ số mới: ${roomData['ĐIỆN MỚI']}, Tổng số điện: ${roomData['TỔNG SỐ ĐIỆN']})
    - Tiền nước: ${roomData['NƯỚC']}
    - Phí dịch vụ khác (DV): ${roomData['DV']}
    - **TỔNG CỘNG PHẢI THANH TOÁN:** ${roomData['TỔNG TIỀN PHẢI THANH TOÁN']}

    **Thông tin thanh toán:**
    - Ngân hàng: ${paymentInfo.bankName}
    - Số tài khoản: ${paymentInfo.accountNumber}
    - Tên chủ tài khoản: ${paymentInfo.accountName}
    - Nội dung chuyển khoản yêu cầu: "${paymentNote}"

    **Yêu cầu về định dạng:**
    - Bắt đầu bằng một lời chào thân mật đến người thuê.
    - Liệt kê rõ ràng và minh bạch các khoản phí.
    - In đậm tổng số tiền cần thanh toán.
    - Cung cấp đầy đủ thông tin thanh toán.
    - Kết thúc bằng một lời cảm ơn.
    - Giữ giọng văn lịch sự, chuyên nghiệp nhưng vẫn gần gũi.
    - Không sử dụng markdown. Trả về dưới dạng văn bản thuần túy (plain text).
  `;
}

export async function generateInvoiceContent(data: InvoiceData): Promise<string> {
  const prompt = createPrompt(data);

  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API error:", error);
    if (error instanceof Error) {
        return `Lỗi khi gọi AI: ${error.message}`;
    }
    return "Đã xảy ra lỗi không xác định khi tạo nội dung hóa đơn.";
  }
}
