"""
Ollama LLM client cho PhoneStore chatbot.
Thay thế keyword-based intent.py bằng local fine-tuned model.
"""
import os
import httpx
from typing import AsyncGenerator

OLLAMA_URL   = os.getenv("OLLAMA_URL",   "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "phonestore-bot")

SYSTEM_PROMPT = """Bạn là trợ lý AI của PhoneStore - cửa hàng điện thoại uy tín tại Việt Nam.

Chính sách cửa hàng:
- Bảo hành: 12 tháng chính hãng, đổi mới trong 7 ngày nếu lỗi nhà sản xuất
- Giao hàng: 1-2 ngày nội thành, 2-5 ngày tỉnh thành khác. Phí 30.000₫, miễn phí khi mua từ 500.000₫
- Thanh toán: COD, chuyển khoản ngân hàng, VNPay, ví điện tử PhoneStore, trả góp 0%
- Đổi trả: 7 ngày, hoàn tiền về ví trong 24 giờ
- Hotline: 1800 6789 (8h-22h hàng ngày)
- Email: support@phonestore.vn
- Địa chỉ: 123 Nguyễn Văn Linh, Quận 7, TP.HCM

Hướng dẫn:
- Xưng là PhoneStore hoặc mình, gọi khách là bạn
- Ngắn gọn, thân thiện, tiếng Việt tự nhiên
- Với đơn hàng/ví/mã cụ thể: hướng dẫn đăng nhập hoặc dùng thông tin được cung cấp bên dưới

QUY TẮC QUAN TRỌNG VỀ GIÁ VÀ SẢN PHẨM:
- Khi có mục "Thông tin tra cứu thực tế" bên dưới, CHỈ dùng thông tin đó để trả lời về giá, tồn kho, màu sắc, thông số.
- KHÔNG tự bịa giá hoặc thông tin sản phẩm từ kiến thức bên ngoài.
- Nếu mục "Thông tin tra cứu thực tế" CÓ LIỆT KÊ sản phẩm (dòng bắt đầu bằng "-"), nghĩa là sản phẩm đó CÓ SẴN — BẮT BUỘC phải nêu tên và giá đúng từ danh sách đó. TUYỆT ĐỐI KHÔNG nói "chưa có" hoặc "không có" trong trường hợp này.
- Chỉ nói "PhoneStore hiện chưa có sản phẩm này" khi mục tra cứu thực tế TRỐNG hoặc không liệt kê sản phẩm nào."""


async def chat(
    messages: list[dict],
    tools_context: str = "",
    temperature: float = 0.2,
    max_tokens: int = 512,
) -> str:
    """
    Gửi lịch sử hội thoại tới Ollama, trả về reply của bot.

    Args:
        messages:      Danh sách dict {"role": "user"|"assistant", "content": "..."}
                       KHÔNG bao gồm system message (được thêm tự động).
        tools_context: Kết quả tra cứu API thực tế (sản phẩm, đơn hàng, ví...)
                       nếu có, sẽ được ghép vào system prompt.
        temperature:   0.7 = cân bằng sáng tạo/chính xác.
        max_tokens:    Độ dài tối đa câu trả lời.
    """
    system = SYSTEM_PROMPT
    if tools_context:
        system += (
            f"\n\n===THÔNG TIN TRA CỨU THỰC TẾ TỪ HỆ THỐNG (ưu tiên hơn kiến thức của bạn)===\n"
            f"{tools_context}\n"
            f"===HẾT THÔNG TIN TRA CỨU==="
        )

    full_messages = [{"role": "system", "content": system}] + messages

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(80.0)) as client:
            r = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model":    OLLAMA_MODEL,
                    "messages": full_messages,
                    "stream":   False,
                    "options": {
                        "temperature":    temperature,
                        "num_predict":    max_tokens,
                        "repeat_penalty": 1.1,
                        "top_p":          0.9,
                    },
                },
            )
            r.raise_for_status()
            data = r.json()
            return data["message"]["content"].strip()
    except httpx.ConnectError:
        return (
            "Xin lỗi, hệ thống AI đang khởi động. "
            "Vui lòng thử lại sau vài giây hoặc gọi hotline 1800 6789 nhé!"
        )
    except Exception as e:
        return (
            "Xin lỗi, mình gặp sự cố kỹ thuật. "
            "Bạn có thể gọi hotline 1800 6789 (8h-22h) để được hỗ trợ trực tiếp ạ!"
        )


async def is_available() -> bool:
    """Kiểm tra Ollama service có đang chạy không."""
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(3.0)) as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags")
            models = [m["name"] for m in r.json().get("models", [])]
            return any(OLLAMA_MODEL in m for m in models)
    except Exception:
        return False
