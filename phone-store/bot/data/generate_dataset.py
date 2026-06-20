"""
Script sinh training samples cho PhoneStore chatbot.
Output: data/train_real.jsonl (format ChatML — dùng để fine-tune Qwen2.5-Instruct)

QUAN TRỌNG: với các intent mà bot/llm.py chèn "tools_context" lúc chạy thật
(search/price_range/orders/wallet/flash_sales — xem main.py _needs_live_data),
dataset PHẢI mô phỏng đúng định dạng context đó trong system prompt, để model
học được cách trích xuất/dùng dữ liệu thật thay vì trả lời chung chung.

Chạy: python data/generate_dataset.py
"""

import json
import os
import random
import re
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / "server" / ".env")

try:
    from pymongo import MongoClient
except ImportError:
    print("Cài pymongo trước: pip install pymongo")
    raise

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/phonestore")
OUTPUT_FILE = Path(__file__).parent / "train_real.jsonl"

#  CHÚ Ý: phải khớp 100% với SYSTEM_PROMPT trong bot/llm.py — vì đó là prompt
#  thực tế được gửi cho model lúc chạy production.
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

# Phải khớp 100% với khối context trong bot/llm.py chat()
CONTEXT_HEADER = "===THÔNG TIN TRA CỨU THỰC TẾ TỪ HỆ THỐNG (ưu tiên hơn kiến thức của bạn)===\n"
CONTEXT_FOOTER = "\n===HẾT THÔNG TIN TRA CỨU==="


def fmt(v) -> str:
    try:
        return f"{int(v):,}₫".replace(",", ".")
    except Exception:
        return str(v)


def s(user: str, bot: str, context: str | None = None) -> dict:
    """Sinh 1 mẫu ChatML. Nếu context được truyền, chèn đúng định dạng
    giống bot/llm.py lúc chạy thật — để model học pattern dùng dữ liệu tra cứu."""
    sys_prompt = SYSTEM_PROMPT
    if context:
        sys_prompt += f"\n\n{CONTEXT_HEADER}{context}{CONTEXT_FOOTER}"
    return {
        "text": (
            f"<|im_start|>system\n{sys_prompt}<|im_end|>\n"
            f"<|im_start|>user\n{user}<|im_end|>\n"
            f"<|im_start|>assistant\n{bot}<|im_end|>"
        )
    }


# ══════════════════════════════════════════════════════════════════════
# Helpers — format context giống main.py _format_products_detailed/...
# ══════════════════════════════════════════════════════════════════════

def format_products_context(products: list[dict]) -> str:
    """Giống main.py _format_products_detailed() — KHÔNG kèm variant detail."""
    if not products:
        return ""
    lines = ["Sản phẩm tìm được:"]
    for p in products[:4]:
        rating_str = f" ⭐{p['rating']:.1f}" if p.get("rating") else ""
        lines.append(f"- {p['name']}: {fmt(p['price'])}{rating_str} | /products/{p['slug']}")
    return "\n".join(lines)


def format_coupons_context(coupons: list[dict]) -> str:
    """Giống main.py _format_coupons() — coupons là list dict {code, type, value, minOrderValue}."""
    if not coupons:
        return "Hiện không có mã giảm giá nào đang áp dụng."
    lines = ["Mã giảm giá đang áp dụng:"]
    for c in coupons[:6]:
        value_str = f"{c['value']}%" if c["type"] == "percent" else fmt(c["value"])
        min_order = c.get("minOrderValue") or 0
        min_str = f" cho đơn từ {fmt(min_order)}" if min_order else ""
        lines.append(f"- {c['code']}: Giảm {value_str}{min_str}")
    return "\n".join(lines)


def format_product_with_variants_context(p: dict) -> str:
    """Giống main.py _format_products_detailed() khi có detail cho sp đầu tiên."""
    rating_str = f" ⭐{p['rating']:.1f}" if p.get("rating") else ""
    lines = ["Sản phẩm tìm được:", f"- {p['name']}: {fmt(p['price'])}{rating_str} | /products/{p['slug']}"]
    if p.get("variants"):
        lines.append("  Phiên bản:")
        for v in p["variants"]:
            label = " / ".join(filter(None, [v.get("color", ""), v.get("storage", "")]))
            status = "còn hàng" if v.get("stock", 0) > 0 else "hết hàng"
            lines.append(f"    + {label}: {fmt(v['price'])} ({status})")
    return "\n".join(lines)


def fetch_product_info(db) -> list[dict]:
    """Lấy product + variant thật từ MongoDB, dạng dict gọn để dùng trong nhiều generator."""
    products = list(db.products.find({"isActive": {"$ne": False}}).limit(400))
    all_ids = [p["_id"] for p in products]
    variants_by_product: dict = {}
    for v in db.productvariants.find({"productId": {"$in": all_ids}}):
        pid = str(v["productId"])
        variants_by_product.setdefault(pid, []).append(v)

    cats = list(db.categories.find({}, {"slug": 1, "type": 1}))
    cat_slug_by_id = {str(c["_id"]): c.get("slug", "") for c in cats}
    cat_type_by_id = {str(c["_id"]): c.get("type", "phone") for c in cats}

    info = []
    for p in products:
        name = (p.get("name") or "").strip()
        if not name:
            continue
        pid = str(p["_id"])
        variants = variants_by_product.get(pid, [])
        if not variants:
            continue
        prices = [v.get("salePrice") or v.get("price") or 0 for v in variants]
        min_price = min(prices, default=0)
        if not min_price:
            continue
        info.append({
            "name": name,
            "slug": p.get("slug", ""),
            "price": min_price,
            "rating": p.get("rating", 0),
            "categorySlug": cat_slug_by_id.get(str(p.get("categoryId", "")), ""),
            "categoryType": cat_type_by_id.get(str(p.get("categoryId", "")), "phone"),
            "variants": [
                {
                    "color": v.get("color", ""),
                    "storage": v.get("storage", ""),
                    "price": v.get("salePrice") or v.get("price") or 0,
                    "stock": v.get("stock", 0),
                }
                for v in variants[:4]
            ],
        })
    return info


# ══════════════════════════════════════════════════════════════════════
# Static intents — KHÔNG nhận tools_context lúc chạy thật, giữ nguyên
# ══════════════════════════════════════════════════════════════════════

def gen_greeting() -> list[dict]:
    GREETING_BOT = [
        "Xin chào! Mình là trợ lý AI của PhoneStore. Mình có thể giúp bạn:\n• Tìm sản phẩm & xem giá\n• Kiểm tra đơn hàng\n• Tư vấn chọn máy\n• Hỏi về chính sách giao hàng, bảo hành\n\nBạn cần hỗ trợ gì ạ?",
        "Chào bạn! PhoneStore xin chào! Bạn muốn tìm điện thoại, phụ kiện hay cần tư vấn gì không ạ?",
        "Chào mừng bạn đến PhoneStore! Mình có thể giúp bạn tìm sản phẩm, kiểm tra đơn hàng hoặc tư vấn chọn máy. Bạn cần gì ạ?",
        "Xin chào! Rất vui được hỗ trợ bạn. PhoneStore chuyên điện thoại & phụ kiện chính hãng. Bạn đang tìm kiếm gì?",
        "Chào bạn! Mình là bot hỗ trợ của PhoneStore đây. Bạn cần tư vấn sản phẩm hay hỏi về đơn hàng ạ?",
        "Xin chào! PhoneStore luôn sẵn sàng hỗ trợ bạn 24/7. Bạn cần tìm sản phẩm hay hỏi gì không?",
        "Chào bạn thân mến! Mình có thể giúp gì cho bạn hôm nay?",
    ]
    questions = [
        "Xin chào!", "Chào shop!", "Hello bạn ơi", "Hi", "Hey",
        "Alo PhoneStore", "Cho mình hỏi chút", "Shop ơi", "Bạn ơi giúp mình",
        "Mình cần tư vấn", "Hỗ trợ mình với", "Xin chào PhoneStore",
        "Chào em", "Chào anh/chị", "Cho hỏi tí nhé", "Có ai không?",
        "Hỏi chút được không?", "Tôi cần hỗ trợ", "Nhờ tư vấn giúp mình nhé",
        "Shop đang online không?", "Cho mình hỏi", "Hỏi thăm chút nhé",
        "Chào buổi sáng", "Chào buổi tối", "Mình đang xem sản phẩm trên web",
        "Tư vấn giúp mình với", "Cần hỗ trợ gấp", "Hello PhoneStore",
        "Xin chào mình cần hỏi", "Giúp mình với nhé", "Chào hỏi chút",
        "Mình mới vào web lần đầu", "Tôi muốn mua điện thoại",
        "Chào, tôi cần tư vấn", "Hi shop, mình muốn hỏi",
        "Ờ chào", "Chào hẳn luôn nha", "Có bạn nào đó không?",
        "Tôi muốn đặt hàng", "Bắt đầu nào", "Hey hey",
        "OK chào shop", "Chào cửa hàng", "Mình là khách hàng mới",
        "Shop ơi tư vấn đi", "Helo", "Chào bạn ơi",
        "Nhờ shop tư vấn giùm", "Cho hỏi nhé", "Hỏi nhanh thôi",
        "Xin hỏi", "Chào PhoneStore", "Hi bạn ơi",
        "Bắt đầu chat thôi", "Giúp mình với", "Cần hỏi điều này",
        "Ơi shop ơi", "Bạn đang trực không?", "Ai đó giúp mình với",
        "Mình cần hỗ trợ gấp", "Xin chào shop yêu", "Hello hello",
        "Chào chào", "Shop có ai không nhỉ?", "Cho mình chat với",
        "Mình đang cần tư vấn mua máy", "Tôi cần giúp đỡ",
        "Bạn ơi mình cần hỏi chút", "Xin được hỗ trợ",
        "Chào buổi chiều", "Cho hỏi shop ơi", "Mình mới đăng ký tài khoản",
        "Tôi vừa vào trang web", "Cho em hỏi ạ",
    ]
    return [s(q, random.choice(GREETING_BOT)) for q in questions]


def gen_goodbye() -> list[dict]:
    BOT = [
        "Cảm ơn bạn đã liên hệ PhoneStore! Chúc bạn một ngày tốt lành nhé!",
        "Rất vui được hỗ trợ bạn! Nếu cần gì cứ quay lại nhé. Bye bạn!",
        "Tạm biệt bạn! PhoneStore luôn sẵn sàng hỗ trợ 24/7. Hẹn gặp lại!",
        "Cảm ơn bạn đã tin tưởng PhoneStore! Chúc mua sắm vui vẻ!",
        "Không có gì! Nếu cần thêm gì cứ nhắn nhé. Chào bạn!",
        "Cảm ơn bạn đã ghé PhoneStore. Chúc bạn hài lòng với sản phẩm!",
        "Cảm ơn bạn! Mình luôn ở đây nếu bạn cần hỗ trợ thêm nhé!",
    ]
    questions = [
        "Cảm ơn bạn nhé!", "Cám ơn shop nhiều lắm", "Thanks bạn",
        "Thank you nhiều nhé", "Bye shop", "Tạm biệt nhé",
        "Ok mình biết rồi, cảm ơn", "Thôi thôi biết rồi thanks",
        "Oke mình đi mua rồi, cảm ơn", "Tuyệt, cảm ơn tư vấn",
        "Cảm ơn đã hỗ trợ", "OK bye nha", "Tạm biệt PhoneStore",
        "Cảm ơn nhiều", "Hẹn gặp lại nhé", "Mình mua rồi nhé cảm ơn",
        "Thôi đủ rồi cảm ơn", "Ok vậy thôi tks", "Cảm ơn bạn đã giải đáp",
        "Thanks nhiều lắm nha shop", "Vậy là đủ thông tin rồi cảm ơn",
        "OK thanks bye", "Mình hỏi vậy thôi, thanks", "Giải đáp hay lắm cảm ơn",
        "Oke vậy nhé hẹn gặp lại", "Tks shop bye", "Bái bai",
        "Thôi nhé cảm ơn nhiều", "Ok được rồi cảm ơn",
        "Mình quyết định mua rồi cảm ơn", "Thôi mình đặt hàng đây, cảm ơn",
        "Xem xong rồi, cảm ơn nhé", "Tư vấn tốt lắm cảm ơn",
        "Đã hiểu cảm ơn shop", "Trả lời hay lắm thanks",
        "Mình đặt rồi, cảm ơn shop nhiều", "Okiê cảm ơn nha",
        "Thôi để mình nghĩ thêm, cảm ơn", "Bye bye nhé",
        "Ok thôi chào shop", "Mình đi xem thêm đã, tks",
        "Cảm ơn vì đã tư vấn", "Bạn nhiệt tình lắm cảm ơn",
        "Xin cảm ơn ạ", "Dạ cảm ơn shop nhiều ạ",
    ]
    return [s(q, random.choice(BOT)) for q in questions]


def gen_faq_shipping() -> list[dict]:
    ANSWERS = [
        "PhoneStore giao hàng trong 1-2 ngày tại Hà Nội & TP.HCM, 3-5 ngày các tỉnh thành khác. Phí ship 30.000₫, đơn từ 500.000₫ được freeship toàn quốc.",
        "Giao hàng nội thành Hà Nội/HCM: 1-2 ngày. Tỉnh thành: 2-5 ngày. Phí 30.000₫ — miễn phí với đơn từ 500.000₫.",
        "Phí vận chuyển 30.000₫. Đơn hàng trên 500.000₫ được freeship! Thời gian giao: 1-2 ngày nội thành, 3-5 ngày tỉnh khác.",
        "Mình ship toàn quốc. Nội thành HN/HCM giao 1-2 ngày, tỉnh 3-5 ngày. Phí 30k, freeship đơn ≥ 500k nhé.",
        "Về giao hàng: 1-2 ngày TP lớn, 3-5 ngày tỉnh. Phí ship 30.000₫/đơn, miễn phí nếu đơn ≥ 500.000₫.",
    ]
    questions = [
        "Giao hàng mất bao lâu?", "Phí ship bao nhiêu?", "Bao lâu thì nhận được hàng?",
        "PhoneStore giao hàng toàn quốc không?", "Ship bao lâu tới?",
        "Phí vận chuyển là bao nhiêu?", "Đặt hôm nay bao giờ có hàng?",
        "Giao hàng nội thành mất mấy ngày?", "Tỉnh xa có giao không?",
        "Giao tới tỉnh lẻ bao lâu vậy?", "Miễn phí ship từ bao nhiêu?",
        "Freeship khi nào?", "Đơn bao nhiêu thì được freeship?",
        "Ship nhanh không?", "Có giao hàng hỏa tốc không?",
        "Thứ 7 CN có giao hàng không?", "Vận chuyển mất mấy ngày?",
        "Tôi ở Đà Nẵng thì mấy ngày nhận được?", "Miền Tây có ship không?",
        "Giao hàng có tính phí không?", "Hỏi phí giao hàng đi",
        "Mình ở Hà Nội đặt bao lâu tới?", "TP HCM mấy ngày nhận được?",
        "Có ship đồng giá không?", "Phí ship mắc không?",
        "Từ 500k thì freeship đúng không?", "Đơn dưới 500k thì ship mấy tiền?",
        "Nếu đơn 499k thì phí ship bao nhiêu?", "Ship express có không?",
        "Giao tận nơi không?", "Ship về vùng sâu vùng xa được không?",
        "Giao hàng ngày lễ có không?", "Tết có giao hàng không?",
        "Giao hàng có theo dõi được không?", "Cách theo dõi đơn ship?",
        "Đặt buổi sáng chiều có hàng không?", "Ship qua GHN hay GHTK?",
        "Đơn đặt tối có giao sáng hôm sau không?", "Giao hàng có cần ký nhận không?",
        "Mình đi làm, ai nhận hàng giúp được không?", "Có thể đặt giờ giao không?",
        "Giao hàng vào cuối tuần được không?", "Hàng giao bao gói như thế nào?",
        "Sản phẩm được đóng gói thế nào khi ship?", "Có bảo hiểm hàng hóa khi ship không?",
        "Hàng bị vỡ khi vận chuyển thì sao?", "Điện thoại giao có nguyên hộp không?",
    ]
    return [s(q, random.choice(ANSWERS)) for q in questions]


def gen_faq_warranty() -> list[dict]:
    ANSWERS = [
        "PhoneStore bảo hành 12 tháng chính hãng cho tất cả sản phẩm điện thoại. Đổi mới trong 7 ngày nếu lỗi nhà sản xuất. Hotline hỗ trợ: 1800 6789 (8h-22h).",
        "Bảo hành 12 tháng chính hãng. Trong 7 ngày đầu nếu lỗi nhà sản xuất được đổi máy mới. Sau 7 ngày sửa miễn phí trong thời hạn bảo hành.",
        "Máy được bảo hành 12 tháng chính hãng. 7 ngày đầu lỗi nhà sản xuất → đổi mới ngay. Lỗi trong 12 tháng → sửa miễn phí. Gọi 1800 6789 để được hỗ trợ.",
        "Tất cả điện thoại tại PhoneStore đều bảo hành 12 tháng. 7 ngày đổi mới nếu lỗi do nhà sản xuất. Hotline: 1800 6789.",
        "Chính sách bảo hành PhoneStore: 12 tháng chính hãng, đổi mới 7 ngày với lỗi nhà sản xuất, sửa miễn phí trong hạn bảo hành. Liên hệ 1800 6789.",
    ]
    questions = [
        "Bảo hành bao lâu?", "Chính sách bảo hành thế nào?",
        "Máy bị lỗi thì xử lý sao?", "Bảo hành có bao gồm những gì?",
        "12 tháng bảo hành là chính hãng không?", "Lỗi trong 7 ngày thì được đổi không?",
        "Đổi máy mới trong bao nhiêu ngày?", "Điện thoại hỏng trong tháng đầu thì sao?",
        "Pin bị phồng thì bảo hành không?", "Màn hình bị lỗi có bảo hành không?",
        "Bảo hành có hỗ trợ tại nhà không?", "Sản phẩm lỗi khi nhận thì làm sao?",
        "Mua máy xong về lỗi thì sao?", "Nếu máy hỏng sau 1 tuần thì được đổi không?",
        "Bảo hành ở đâu?", "Phải mang máy tới đâu để bảo hành?",
        "Thời gian bảo hành là mấy tháng?", "Có bảo hành không?",
        "Chính sách đổi trả như thế nào?", "Sản phẩm có bảo hành chính hãng không?",
        "Lỗi phần mềm có được bảo hành không?", "Camera hỏng có bảo hành không?",
        "Máy rơi vỡ có bảo hành không?", "Bảo hành có tính phí không?",
        "Sửa chữa mất mấy ngày?", "Máy gửi đi sửa bao lâu trả?",
        "Phụ kiện trong hộp có bảo hành không?", "Sạc bị lỗi có đổi không?",
        "Tai nghe trong hộp bị lỗi có bảo hành?", "Máy bị quá nhiệt có bảo hành không?",
        "Hết hạn bảo hành thì sửa có mất phí không?", "Bảo hành vật lý hay điện tử?",
        "Phiếu bảo hành gửi qua email không?", "Mất phiếu bảo hành thì có bảo hành không?",
        "Điện thoại cũ mua ở shop có bảo hành không?", "Hàng trưng bày có bảo hành bao lâu?",
        "Máy refurbished có bảo hành không?", "Bảo hành có cover pin không?",
        "Sau 12 tháng bị lỗi thì phải làm sao?", "Sản phẩm có seal chính hãng không?",
        "Điện thoại mua online có bảo hành như mua trực tiếp không?",
        "Bảo hành có check IMEI không?", "Máy Lock hay Unlock bảo hành được không?",
        "Bảo hành có bao gồm phần mềm không?", "Lỗi do người dùng có bảo hành không?",
        "Bảo hành toàn quốc không?", "Ở tỉnh có thể bảo hành tại cửa hàng địa phương không?",
    ]
    return [s(q, random.choice(ANSWERS)) for q in questions]


def gen_faq_payment() -> list[dict]:
    ANSWERS = [
        "PhoneStore hỗ trợ nhiều hình thức thanh toán:\n• COD (trả khi nhận hàng)\n• Chuyển khoản ngân hàng (VietQR)\n• VNPay (thẻ ATM, Visa, Mastercard)\n• Ví điện tử PhoneStore\n• Trả góp 0% qua thẻ tín dụng",
        "Bạn có thể thanh toán bằng: COD, chuyển khoản ngân hàng, VNPay, ví PhoneStore hoặc trả góp 0% (từ 6-24 tháng). Rất linh hoạt nhé!",
        "PhoneStore nhận thanh toán: tiền mặt khi nhận hàng (COD), chuyển khoản, VNPay, ví điện tử và trả góp 0% lãi suất.",
        "Thanh toán linh hoạt tại PhoneStore: COD / bank transfer / VNPay / ví / trả góp 0%. Bạn thích hình thức nào ạ?",
        "Mình hỗ trợ: COD, chuyển khoản VietQR, VNPay, ví PhoneStore và trả góp 0% 6-24 tháng qua thẻ tín dụng. Khá đầy đủ nhé!",
    ]
    questions = [
        "Có những hình thức thanh toán nào?", "Thanh toán COD được không?",
        "Có nhận chuyển khoản không?", "Trả bằng VNPay được không?",
        "Mình dùng ví điện tử thanh toán được không?", "Có trả góp 0% không?",
        "Trả góp qua thẻ tín dụng được không?", "Thanh toán thế nào?",
        "Không có thẻ tín dụng thì trả góp được không?", "Trả tiền mặt được không?",
        "Trả góp lãi suất bao nhiêu?", "Trả góp 0% trong bao lâu?",
        "Momo có nhận không?", "Zalopay có không?", "Thẻ Visa có dùng được không?",
        "Thẻ ATM nội địa thanh toán online được không?", "Thanh toán trước hay sau?",
        "Mình chuyển khoản trước khi giao không?", "Nhận hàng rồi mới trả tiền được không?",
        "Có phí thanh toán online không?", "Dùng ví điện tử thì giảm thêm không?",
        "Thẻ tín dụng nào được trả góp 0%?", "Ngân hàng nào hỗ trợ trả góp?",
        "Trả góp từ 6 hay 12 tháng?", "Phí trả góp là bao nhiêu?",
        "QR code có nhận không?", "Thẻ Mastercard thanh toán được không?",
        "Ví PhoneStore là gì vậy?", "Nạp tiền vào ví PhoneStore như thế nào?",
        "Thanh toán bằng điểm thưởng được không?",
        "Có nhận thẻ JCB không?", "Thanh toán bằng crypto được không?",
        "Trả góp có cần chứng minh thu nhập không?", "Điều kiện trả góp là gì?",
        "Có ưu đãi gì khi trả qua VNPay không?", "Chuyển khoản thì chuyển vào số tài khoản nào?",
        "Mã QR để chuyển khoản ở đâu?", "Đặt hàng COD có cần đặt cọc không?",
        "Thất bại thanh toán VNPay thì xử lý sao?", "Thanh toán lỗi thì tiền có bị trừ không?",
        "Đã chuyển khoản nhưng đơn chưa xác nhận thì làm sao?",
        "Hoàn tiền khi hủy đơn mất bao lâu?", "Hủy đơn đã thanh toán tiền về đâu?",
        "Tiền hoàn khi trả hàng về tài khoản hay ví?",
        "Có thể đổi hình thức thanh toán sau khi đặt không?",
    ]
    return [s(q, random.choice(ANSWERS)) for q in questions]


def gen_contact_info() -> list[dict]:
    ANSWERS = [
        "Hotline PhoneStore: **1800 6789** (miễn phí, 8h-22h hàng ngày). Email: support@phonestore.vn. Bạn cũng có thể chat trực tiếp với nhân viên tư vấn tại website.",
        "Liên hệ PhoneStore:\n• Hotline: 1800 6789 (8h-22h, miễn phí)\n• Email: support@phonestore.vn\n• Chat trực tiếp tại website\n• Fanpage Facebook: PhoneStore VN",
        "Gọi hotline 1800 6789 nhé! Miễn phí, phục vụ 8h đến 22h mỗi ngày. Hoặc nhắn tin qua fanpage Facebook của PhoneStore.",
        "Số hotline: 1800 6789 (free, 8h-22h). Nếu cần hỗ trợ ngay bạn cũng có thể chat ở đây nhé!",
    ]
    questions = [
        "Hotline PhoneStore là gì?", "Số điện thoại liên hệ?",
        "Gọi vào đâu để tư vấn?", "Email PhoneStore là gì?",
        "Địa chỉ cửa hàng ở đâu?", "Shop có địa chỉ không?",
        "Cửa hàng PhoneStore ở đâu?", "Muốn gặp nhân viên tư vấn thì làm sao?",
        "Có thể liên hệ thế nào?", "Làm sao để liên lạc với shop?",
        "Số điện thoại hỗ trợ?", "Contact PhoneStore như thế nào?",
        "Hotline miễn phí không?", "Gọi 1800 6789 có mất phí không?",
        "Fanpage Facebook PhoneStore?", "Có hỗ trợ qua Zalo không?",
        "Chat với nhân viên được không?", "Giờ làm việc là mấy giờ?",
        "Shop đóng cửa lúc mấy giờ?", "Hỗ trợ 24/7 không?",
        "Nhân viên online giờ nào?", "Có cửa hàng offline không?",
        "Showroom PhoneStore ở đâu?",
        "Liên hệ khẩn cấp như thế nào?", "Gọi vào 1800 6789 bao lâu được nghe máy?",
        "Có thể nhắn tin thay vì gọi điện không?", "Hỗ trợ qua email không?",
        "Phản hồi qua email mất bao lâu?", "Có thể đến trực tiếp cửa hàng không?",
        "Có cửa hàng ở Hà Nội không?", "Có showroom ở TP HCM không?",
        "Cửa hàng ở quận mấy?", "PhoneStore có app không?",
        "Tải app PhoneStore ở đâu?", "Theo dõi PhoneStore trên mạng xã hội?",
        "Instagram PhoneStore?", "Gọi hotline khi nào?",
        "Bot này có thể kết nối tôi với nhân viên thật không?",
        "Tôi muốn nói chuyện với người thật", "Gặp nhân viên tư vấn trực tiếp",
    ]
    return [s(q, random.choice(ANSWERS)) for q in questions]


def gen_return_product() -> list[dict]:
    ANSWERS = [
        "Chính sách đổi trả PhoneStore:\n• 7 ngày đầu: đổi mới nếu lỗi nhà sản xuất, còn nguyên hộp\n• Hoàn tiền về ví trong 24h sau khi duyệt\n• Hotline hỗ trợ: 1800 6789",
        "Bạn có thể trả hàng trong 7 ngày nếu sản phẩm lỗi nhà sản xuất. Hoàn tiền về ví điện tử PhoneStore trong 24h. Liên hệ 1800 6789 để được hướng dẫn cụ thể nhé.",
        "Quy trình trả hàng: Liên hệ 1800 6789 hoặc vào mục 'Đơn hàng' → 'Yêu cầu trả hàng' → điền lý do → PhoneStore xem xét trong 24h → hoàn tiền về ví.",
        "PhoneStore hỗ trợ đổi trả 7 ngày. Điều kiện: lỗi nhà sản xuất, còn nguyên hộp và phụ kiện. Hoàn tiền 100% về ví PhoneStore trong vòng 24h.",
    ]
    questions = [
        "Mình muốn trả hàng", "Đổi hàng như thế nào?",
        "Máy bị lỗi muốn đổi trả", "Chính sách đổi trả thế nào?",
        "Hoàn tiền như thế nào?", "Refund mất bao lâu?",
        "Mình không hài lòng muốn trả máy lại", "Đổi máy mới được không?",
        "Hàng về không đúng mô tả, trả được không?", "Trả hàng cần điều kiện gì?",
        "Đổi màu khác được không?", "Muốn đổi model khác được không?",
        "Mua về rồi đổi ý muốn trả?", "Trả hàng thì tiền về đâu?",
        "Tiền hoàn lại mất bao lâu?", "Trả hàng thì mất phí không?",
        "Phí đổi trả là bao nhiêu?", "Điều kiện để đổi hàng là gì?",
        "Hàng bị vỡ khi giao có đổi không?", "Nhận sai màu thì xử lý sao?",
        "Nhận thiếu phụ kiện thì phải làm gì?", "Không hài lòng về chất lượng thì sao?",
        "Cách yêu cầu đổi trả?", "Gửi yêu cầu đổi trả ở đâu?",
        "Đơn hàng đã giao nhưng máy lỗi, giờ phải làm gì?",
        "Tôi muốn hoàn tiền", "Quy trình hoàn tiền?",
        "Mua online trả hàng có khó không?",
        "Trả hàng phải gửi về địa chỉ nào?", "Phí gửi hàng trả về ai chịu?",
        "Đã dùng rồi có đổi được không?", "Hộp bị hư có đổi không?",
        "Điện thoại đã kích hoạt còn đổi được không?",
        "7 ngày tính từ lúc đặt hay lúc nhận?", "Quá 7 ngày thì làm gì?",
        "Có thể đổi sang sản phẩm đắt hơn hay rẻ hơn không?",
        "Trả hàng có ảnh hưởng tài khoản không?", "Lần trả thứ 2 có được không?",
    ]
    return [s(q, random.choice(ANSWERS)) for q in questions]


def gen_cancel_order() -> list[dict]:
    """Hỏi hủy đơn hàng — trước đó không có mẫu nào, câu hỏi rơi vào fallback (không trả
    lời được). Khớp đúng điều kiện thật ở order.controller.js cancelOrder(): chỉ hủy được
    khi đơn ở trạng thái 'pending'/'confirmed', hoàn tiền về ví nếu đã thanh toán qua ví."""
    ANSWERS = [
        "Bạn có thể tự hủy đơn khi đơn còn ở trạng thái \"Chờ xác nhận\" hoặc \"Đã xác nhận\" — vào trang Đơn hàng → chọn đơn → bấm Hủy đơn. Nếu đã thanh toán qua ví, tiền hoàn lại ngay. Đơn đang giao thì không tự hủy được, gọi 1800 6789 nhé!",
        "Hủy đơn được nếu đơn chưa chuyển sang trạng thái giao hàng (còn ở 'Chờ xác nhận'/'Đã xác nhận'). Vào Đơn hàng → bấm Hủy. Tiền đã thanh toán qua ví sẽ hoàn lại ngay. Đơn đang/đã giao thì liên hệ hotline 1800 6789.",
        "Có, miễn là đơn chưa được chuẩn bị/giao hàng. Bạn vào trang Đơn hàng của mình, chọn đơn cần hủy và bấm Hủy đơn. Thanh toán qua ví sẽ được hoàn lại tự động.",
    ]
    questions = [
        "Tôi có thể hủy đơn được không?", "Hủy đơn hàng thế nào?",
        "Làm sao để hủy đơn vừa đặt?", "Đặt nhầm rồi, hủy được không?",
        "Hủy đơn có mất phí không?", "Hủy đơn rồi tiền có hoàn lại không?",
        "Đơn đang giao có hủy được không?", "Tôi muốn hủy đơn hàng",
        "Cancel đơn vừa mua được không?", "Đặt hàng xong đổi ý hủy được không?",
        "Hủy đơn ở đâu trên web?", "Bao lâu thì không hủy đơn được nữa?",
        "Hủy đơn thanh toán bằng ví thì sao?", "Hủy đơn COD có sao không?",
    ]
    return [s(q, random.choice(ANSWERS)) for q in questions]


def gen_validate_coupon() -> list[dict]:
    COUPON_CODES = ["SALE10", "PHONE20", "DEAL50", "SUMMER15", "VIP30", "NEWUSER", "FLASH25", "HOT100K"]

    def make_coupon_q(code):
        return random.choice([
            f"Mã {code} còn dùng được không?",
            f"Coupon {code} có hợp lệ không?",
            f"Kiểm tra mã giảm giá {code} giúp tôi",
            f"Voucher {code} còn hiệu lực không?",
            f"Tôi có mã {code}, dùng được chứ?",
            f"Mã ưu đãi {code} có áp dụng được không?",
        ])

    VALID_ANSWER = "Bạn vui lòng nhập mã vào ô 'Mã giảm giá' ở trang thanh toán để hệ thống kiểm tra tự động. Nếu mã không hoạt động, liên hệ 1800 6789 nhé!"
    GENERAL_ANSWER = "Để kiểm tra mã giảm giá, bạn nhập vào ô coupon khi thanh toán. Hệ thống sẽ xác nhận ngay. Mã hết hạn hoặc không đúng sẽ thông báo tự động."

    samples = []
    for code in COUPON_CODES * 2:
        samples.append(s(make_coupon_q(code), VALID_ANSWER))

    general_qs = [
        "Tôi có mã giảm giá, dùng thế nào?", "Nhập coupon ở đâu?",
        "Mã khuyến mãi dùng như thế nào?", "Dùng voucher thế nào?",
        "Mã giảm giá có điều kiện gì không?", "Mã áp dụng cho sản phẩm nào?",
        "Một tài khoản dùng được mấy mã?", "Mã giảm giá có hết hạn không?",
        "Khi nào có mã giảm giá mới?", "Đăng ký thành viên có mã giảm giá không?",
        "Mã giảm giá tối thiểu đơn bao nhiêu?", "Mã giảm tối đa bao nhiêu?",
        "Mã giảm theo % hay theo số tiền?", "Có thể kết hợp 2 mã giảm không?",
        "Dùng mã giảm kèm flash sale được không?", "Mã giảm có áp dụng cho phụ kiện không?",
        "Mã giảm có áp dụng cho hàng đang sale không?",
        "Làm sao để nhận mã giảm giá?", "Mã giảm sinh nhật có không?",
        "Giới thiệu bạn bè có được mã giảm không?",
    ]
    for q in general_qs:
        samples.append(s(q, GENERAL_ANSWER))

    return samples


def gen_coupon_list() -> list[dict]:
    """Hỏi 'hiện có mã giảm giá nào' — main.py._needs_live_data() trả về need='coupons',
    bot gọi GET /api/coupons thật và chèn context qua format_coupons_context(). Không sinh
    mẫu này thì model không biết format context "Mã giảm giá đang áp dụng:" / "Hiện không
    có mã giảm giá nào đang áp dụng." là gì, dẫn đến BỊA mã giảm giá không tồn tại (đã verify
    bug này qua test thật — hỏi mã giảm giá lúc DB rỗng, model tự bịa ra 3 mã giả)."""
    questions = [
        "Cửa hàng hiện có các mã giảm giá nào?", "Shop có mã giảm giá nào không?",
        "PhoneStore có mã giảm giá nào không?", "Có code giảm giá không?",
        "Hiện có mã giảm giá nào đang áp dụng không?", "Mã giảm giá nào dùng được bây giờ?",
        "Cho tôi xem các mã giảm giá hiện có", "Đang có voucher gì không?",
        "Có coupon nào đang chạy không?", "Liệt kê mã giảm giá hiện tại giúp tôi",
    ]
    CODE_POOL = [
        {"code": "SALE10", "type": "percent", "value": 10, "minOrderValue": 200_000},
        {"code": "PHONE20", "type": "percent", "value": 20, "minOrderValue": 5_000_000},
        {"code": "DEAL50", "type": "fixed", "value": 50_000, "minOrderValue": 0},
        {"code": "SUMMER15", "type": "percent", "value": 15, "minOrderValue": 1_000_000},
        {"code": "VIP30", "type": "percent", "value": 30, "minOrderValue": 10_000_000},
        {"code": "HOT100K", "type": "fixed", "value": 100_000, "minOrderValue": 2_000_000},
    ]

    samples = []
    for q in questions:
        # ~1/3 mẫu mô phỏng lúc DB rỗng (đúng tình trạng thật hiện tại) — dạy model trả
        # lời trung thực "chưa có mã" thay vì bịa, khi context không liệt kê mã nào.
        if random.random() < 0.35:
            coupons = []
        else:
            coupons = random.sample(CODE_POOL, k=random.randint(1, 4))
        context = format_coupons_context(coupons)
        if coupons:
            names = ", ".join(
                f"{c['code']} (giảm {c['value']}%)" if c["type"] == "percent"
                else f"{c['code']} (giảm {fmt(c['value'])})"
                for c in coupons
            )
            answer = f"PhoneStore hiện có các mã: {names}. Bạn áp dụng ở ô mã giảm giá khi thanh toán nhé!"
        else:
            answer = "Hiện PhoneStore chưa có mã giảm giá nào đang áp dụng. Bạn theo dõi thêm thông báo từ shop nhé!"
        samples.append(s(q, answer, context=context))

    return samples


def gen_fallback() -> list[dict]:
    ANSWERS = [
        "Mình là trợ lý hỗ trợ mua sắm điện thoại và phụ kiện. Câu hỏi này nằm ngoài phạm vi hỗ trợ của mình. Bạn cần giúp đỡ về sản phẩm, đơn hàng hay chính sách mua hàng không?",
        "Xin lỗi, câu hỏi này mình chưa có thông tin để trả lời. Mình có thể giúp bạn tìm sản phẩm, kiểm tra đơn hàng, hoặc giải đáp chính sách PhoneStore. Bạn cần gì?",
        "Mình chỉ hỗ trợ về sản phẩm, đơn hàng và dịch vụ của PhoneStore. Bạn có câu hỏi liên quan không? Hoặc gọi 1800 6789 để gặp nhân viên tư vấn nhé!",
    ]
    questions = [
        "Thời tiết hôm nay thế nào?", "Bạn tên gì?", "Bạn là robot à?",
        "AI này do ai tạo ra?", "Hát bài gì cho tôi nghe đi",
        "Kể chuyện cười đi", "Nói tiếng Anh đi", "Giải toán giúp tôi",
        "Cổ phiếu hôm nay thế nào?", "Tỷ giá USD hôm nay?",
        "Tin tức mới nhất là gì?", "Bóng đá hôm nay?",
        "Cho tôi công thức nấu phở", "Máy tính bảng PhoneStore bán không?",
        "Laptop có không?", "Mua tivi ở đâu?",
        "Có bán quần áo không?", "Gà rán ở đâu ngon?",
        "Bạn ổn không?", "Cuộc sống thế nào?",
        "Bạn có biết tôi là ai không?", "Vui không?",
        "Bây giờ là mấy giờ?", "Hôm nay là thứ mấy?",
    ]
    return [s(q, random.choice(ANSWERS)) for q in questions]


# ══════════════════════════════════════════════════════════════════════
# Context-aware intents — bot/llm.py CHÈN tools_context lúc chạy thật
# (xem main.py _needs_live_data: orders/wallet/flash_sales/price_range/search)
# → dataset PHẢI có context block giống vậy để model học dùng đúng cách.
# ══════════════════════════════════════════════════════════════════════

def gen_product_samples(products_info: list[dict]) -> list[dict]:
    """Hỏi giá/tồn kho/màu/thông số/mua 1 sản phẩm cụ thể — luôn kèm context
    giống _format_products_detailed() (có variant detail cho sp đầu)."""
    samples = []
    for p in products_info:
        name = p["name"]
        context = format_product_with_variants_context(p)
        price_str = fmt(p["price"])

        price_reply = f"{name} hiện có giá {price_str} tại PhoneStore. Bạn xem thêm chi tiết tại /products/{p['slug']} nhé!"
        for q in random.sample([
            f"{name} giá bao nhiêu?", f"Giá {name} là bao nhiêu?",
            f"Cho hỏi {name} bán giá bao nhiêu vậy?", f"{name} bán giá bao nhiêu shop?",
            f"Giá của {name} thế nào?", f"Hỏi giá {name} đi bạn",
        ], k=3):
            samples.append(s(q, price_reply, context=context))

        in_stock = [v for v in p["variants"] if v.get("stock", 0) > 0]
        if in_stock:
            stock_reply = f"{name} hiện còn hàng — {len(in_stock)} phiên bản đang có sẵn. Giá từ {price_str}."
        else:
            stock_reply = f"{name} hiện tạm hết hàng. Bạn có thể để lại số điện thoại, mình sẽ báo ngay khi có hàng nhé!"
        for q in random.sample([
            f"{name} còn hàng không?", f"Shop còn {name} không ạ?",
            f"Mua {name} được không bạn?", f"{name} còn hay hết hàng rồi?",
            f"Tồn kho {name} còn không?",
        ], k=2):
            samples.append(s(q, stock_reply, context=context))

        colors = list({v["color"] for v in p["variants"] if v.get("color")})
        if colors:
            color_reply = f"{name} tại PhoneStore có các màu: {', '.join(colors)}. Giá từ {price_str}. Bạn thích màu nào ạ?"
            for q in random.sample([
                f"{name} có màu nào?", f"{name} màu gì vậy?",
                f"Màu sắc của {name}?", f"Shop có {name} màu gì?",
            ], k=2):
                samples.append(s(q, color_reply, context=context))

        # Thông số — context không có specs chi tiết (RAM/pin), chỉ giá+variant,
        # nên KHÔNG bịa số liệu, chỉ trỏ tới trang chi tiết.
        specs_reply = f"Bạn xem đầy đủ thông số kỹ thuật của {name} tại /products/{p['slug']} nhé. Giá từ {price_str}."
        for q in random.sample([
            f"Thông số kỹ thuật {name}?", f"{name} cấu hình thế nào?",
            f"Specs {name} là gì?", f"{name} có RAM bao nhiêu?",
            f"Pin {name} bao nhiêu mAh?",
        ], k=2):
            samples.append(s(q, specs_reply, context=context))

        avail_reply = (
            f"Dạ PhoneStore có bán {name}! Giá từ {price_str}."
            + (f" Còn {len(in_stock)} phiên bản trong kho." if in_stock else " Hiện đang hết hàng tạm thời.")
            + " Bạn muốn đặt hàng không ạ?"
        )
        samples.append(s(
            random.choice([
                f"Shop có bán {name} không?", f"PhoneStore có {name} không ạ?",
                f"Mình muốn mua {name}, shop có không?", f"Có {name} không bạn?",
            ]),
            avail_reply, context=context,
        ))

    return samples


def gen_named_search_samples(products_info: list[dict]) -> list[dict]:
    """Tìm kiếm / ý định mua theo tên sản phẩm thật — kèm context."""
    samples = []
    for p in products_info:
        name = p["name"]
        context = format_product_with_variants_context(p)
        price_str = fmt(p["price"])

        search_reply = f"PhoneStore có {name}, giá {price_str}. Bạn xem chi tiết tại /products/{p['slug']} nhé!"
        for q in random.sample([
            f"Tìm {name} giúp mình", f"Cho xem {name} đi",
            f"Có {name} không shop?", f"Mình muốn xem {name}",
            f"Search {name} đi bạn", f"PhoneStore có {name} không?",
            f"Shop bán {name} không?",
        ], k=3):
            samples.append(s(q, search_reply, context=context))

        buy_reply = f"{name} hiện có giá {price_str}. Bạn vào /products/{p['slug']} để chọn màu/dung lượng và đặt hàng nhé!"
        for q in random.sample([
            f"Mình muốn mua {name}", f"Cho mình đặt {name} nhé",
            f"Mình cần mua {name} gấp", f"Tôi muốn đặt hàng {name}",
            f"Tôi cần {name}", f"Mua {name} đi shop",
        ], k=3):
            samples.append(s(q, buy_reply, context=context))
    return samples


def gen_price_range(products_info: list[dict]) -> list[dict]:
    """Hỏi máy tầm giá — lọc sản phẩm thật theo khoảng giá, kèm context khi có kết quả.

    Chỉ xét sản phẩm categoryType="phone" — khớp với fix main.py/actions.py
    (get_products_filtered(product_type="phone")) cho intent price_range. Nếu không lọc,
    phụ kiện rẻ (cáp sạc, ốp lưng...) sẽ lọt vào câu trả lời "máy tầm giá X triệu" vì luôn
    rẻ hơn điện thoại — đã verify bug này qua test thật (bot trả lời phụ kiện khi hỏi
    "điện thoại dưới 15 triệu")."""
    products_info = [p for p in products_info if p.get("categoryType", "phone") == "phone"]
    ANSWERS_NO_MATCH = [
        "PhoneStore hiện chưa có sản phẩm trong tầm giá đó. Bạn có thể nới rộng ngân sách hoặc xem các dòng khác trên website nhé!",
        "Hiện chưa tìm thấy máy phù hợp khoảng giá này. Bạn thử mở rộng tầm giá hoặc cho mình biết hãng bạn thích để tư vấn thêm nhé!",
    ]
    BRANDS_VN = ["iPhone", "Samsung", "Xiaomi", "OPPO", "Vivo", "Realme"]
    templates = [
        "Điện thoại {price} có gì?", "Máy {price} nên mua gì?",
        "Tư vấn điện thoại {price}", "{brand} {price} nào tốt?",
        "Có máy nào {price} không?", "Mình có ngân sách {price}, mua máy gì?",
        "Gợi ý điện thoại {price} tốt nhất", "PhoneStore có máy {price} không?",
        "Điện thoại nào ngon {price}?", "Mua máy {price} cho sinh viên",
        "Tặng bạn gái điện thoại {price}", "Điện thoại {price} chụp ảnh đẹp?",
        "Máy pin trâu {price}?", "Điện thoại chơi game {price}?",
        "Máy văn phòng {price} nên mua gì?",
    ]

    def rand_price():
        n = random.choice([3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30])
        return n, max(3, n - 2), min(35, n + 2)

    samples = []
    for _ in range(150):
        n, lo, hi = rand_price()
        mode = random.choice(["tam", "duoi", "tu_den"])
        if mode == "duoi":
            min_p, max_p = None, n * 1_000_000
            price_str = f"dưới {n} triệu"
        elif mode == "tu_den":
            min_p, max_p = lo * 1_000_000, hi * 1_000_000
            price_str = f"từ {lo} đến {hi} triệu"
        else:
            min_p, max_p = lo * 1_000_000, hi * 1_000_000
            price_str = random.choice([f"tầm {n} triệu", f"khoảng {n}tr", f"ngân sách {n} triệu"])

        matched = [p for p in products_info
                   if (min_p is None or p["price"] >= min_p) and (max_p is None or p["price"] <= max_p)]
        random.shuffle(matched)
        matched = matched[:4]

        tmpl = random.choice(templates)
        q = tmpl.format(price=price_str, brand=random.choice(BRANDS_VN))

        if matched:
            context = format_products_context(matched)
            names_prices = ", ".join(f"{m['name']} ({fmt(m['price'])})" for m in matched)
            answer = f"Trong tầm giá đó, PhoneStore có: {names_prices}. Bạn xem chi tiết và đặt hàng trên website nhé!"
            samples.append(s(q, answer, context=context))
        else:
            samples.append(s(q, random.choice(ANSWERS_NO_MATCH)))

    return samples


def gen_new_arrivals(products_info: list[dict]) -> list[dict]:
    """Hỏi 'sản phẩm mới ra mắt/mới nhất' — main.py._needs_live_data() trả về
    need='new_arrivals', bot gọi get_products_filtered(sort="newest") thật. Context dùng
    CHUNG format với search_product (format_products_context — "Sản phẩm tìm được:"), nên
    nếu không có mẫu riêng, model sẽ trả lời kiểu "PhoneStore hiện có: ..." (đúng nhưng
    không khớp ngữ cảnh "mới ra mắt") hoặc mơ hồ không liệt kê — đã verify qua test thật."""
    products_info = [p for p in products_info if p.get("categoryType", "phone") == "phone"]
    questions = [
        "Sản phẩm nào mới ra mắt gần đây?", "Có máy mới về không?",
        "Hàng mới nhất là gì?", "Điện thoại mới ra mắt có gì?",
        "Model mới nhất của PhoneStore là gì?", "Máy nào vừa ra mắt?",
        "Có sản phẩm mới không?", "PhoneStore có hàng mới về chưa?",
        "Xem các máy mới ra mắt giúp tôi", "Điện thoại mới nhất hiện nay?",
    ]
    samples = []
    for q in questions:
        matched = products_info[:4] if products_info else []
        if matched:
            context = format_products_context(matched)
            names_prices = ", ".join(f"{m['name']} ({fmt(m['price'])})" for m in matched)
            answer = f"Sản phẩm mới ra mắt tại PhoneStore: {names_prices}. Bạn xem chi tiết trên website nhé!"
            samples.append(s(q, answer, context=context))
        else:
            samples.append(s(q, "Hiện chưa có thông tin sản phẩm mới. Bạn xem toàn bộ sản phẩm trên website nhé!"))

    return samples


def gen_bestsellers(products_info: list[dict]) -> list[dict]:
    """Hỏi 'best seller/bán chạy' — main.py._needs_live_data() trả về need='bestsellers',
    bot gọi get_products_filtered(sort="popular") thật. Cùng lý do với gen_new_arrivals: nếu
    không có mẫu riêng, model không biết liên hệ context "Sản phẩm tìm được:" với khung trả
    lời "bán chạy" — đã verify qua test thật (hỏi "best seller" model trả lời lạc đề hẳn
    sang chuyện đơn hàng)."""
    products_info = [p for p in products_info if p.get("categoryType", "phone") == "phone"]
    questions = [
        "Các sản phẩm best seller?", "Sản phẩm nào bán chạy nhất?",
        "Điện thoại bán chạy nhất hiện nay?", "Bestseller của PhoneStore là gì?",
        "Máy nào bán nhiều nhất?", "Top sản phẩm bán chạy đi",
        "Sản phẩm nổi bật nhất là gì?", "Điện thoại phổ biến nhất hiện tại?",
        "Cho tôi xem các best seller", "Máy nào được mua nhiều nhất?",
    ]
    samples = []
    for q in questions:
        matched = products_info[:4] if products_info else []
        if matched:
            context = format_products_context(matched)
            names_prices = ", ".join(f"{m['name']} ({fmt(m['price'])})" for m in matched)
            answer = f"Các sản phẩm bán chạy tại PhoneStore: {names_prices}. Bạn xem chi tiết trên website nhé!"
            samples.append(s(q, answer, context=context))
        else:
            samples.append(s(q, "Hiện chưa có dữ liệu bán chạy. Bạn xem toàn bộ sản phẩm trên website nhé!"))

    return samples


def gen_search_product(products_info: list[dict]) -> list[dict]:
    """Hỏi tìm sản phẩm theo hãng/danh mục — kèm context nếu khớp được hãng trong DB."""
    ANSWERS_NO_DATA = [
        "Bạn thử dùng thanh tìm kiếm trên website hoặc vào trang Sản phẩm để lọc theo hãng và giá. Cần tư vấn thêm thì nói mình nghe!",
        "Mình có thể giúp bạn tìm! Bạn muốn tìm sản phẩm cụ thể nào hoặc hãng nào vậy?",
    ]
    # CHÚ Ý: "tai nghe", "ốp lưng", "sạc nhanh", "sạc không dây", "cáp sạc" KHÔNG được
    # đặt ở đây nữa — main.py giờ có _extract_category() tra category thật + RAG context
    # (xem gen_category_accessory_samples), nên các từ này phải dùng dữ liệu thật, không
    # phải câu trả lời chung chung — để cả 2 cùng tồn tại sẽ dạy model 2 hành vi mâu thuẫn
    # cho cùng 1 từ khóa. "sạc dự phòng" vẫn ở đây vì PhoneStore thực sự không bán power bank.
    CATEGORIES_NO_DATA = ["điện thoại", "phụ kiện", "sạc dự phòng", "pin dự phòng"]
    BRAND_KEYWORDS = {
        "Apple": "iphone", "iPhone": "iphone", "Samsung": "samsung",
        "Xiaomi": "xiaomi", "OPPO": "oppo", "Vivo": "vivo",
        "Realme": "realme", "Google Pixel": "pixel",
    }

    samples = []
    for cat in CATEGORIES_NO_DATA:
        for q in [f"Shop có {cat} không?", f"PhoneStore bán {cat} không?",
                   f"Tìm {cat} trên PhoneStore", f"Xem {cat} đi"]:
            samples.append(s(q, random.choice(ANSWERS_NO_DATA)))

    for brand_label, kw in BRAND_KEYWORDS.items():
        matched = [p for p in products_info if kw in p["name"].lower()][:4]
        # "muốn mua + tên hãng chung" (không phải tên sản phẩm cụ thể) PHẢI có mẫu riêng —
        # nếu không, model chỉ thấy "muốn mua" đi kèm tên sản phẩm cụ thể (xem
        # gen_named_search_samples) và học nhầm rằng "muốn mua" luôn = chỉ nói về 1 sản
        # phẩm, dù context thực tế có nhiều sản phẩm (đã verify bug này qua test thật).
        qs = [f"Có {brand_label} không?", f"Điện thoại {brand_label} nào đang có?",
              f"Xem {brand_label} đi", f"PhoneStore có {brand_label} không?",
              f"Muốn mua điện thoại {brand_label}", f"Tôi muốn mua {brand_label}",
              f"Mình muốn mua điện thoại {brand_label}", f"Cho mình mua điện thoại {brand_label}"]
        if matched:
            context = format_products_context(matched)
            names_prices = ", ".join(f"{m['name']} ({fmt(m['price'])})" for m in matched)
            answer = f"PhoneStore hiện có: {names_prices}. Bạn xem chi tiết trên website nhé!"
            for q in qs:
                samples.append(s(q, answer, context=context))
        else:
            for q in qs:
                samples.append(s(q, f"PhoneStore hiện chưa có sản phẩm {brand_label} trong danh mục. Bạn xem các hãng khác trên website nhé!"))

    for q in [
        "Cho xem danh sách sản phẩm", "Tìm điện thoại giúp mình",
        "Muốn xem điện thoại mới nhất", "Sản phẩm mới nhất là gì?",
        "Có hàng mới về không?", "Máy nào mới ra gần đây?",
    ]:
        samples.append(s(q, random.choice(ANSWERS_NO_DATA)))

    return samples


# Category slug thật trên server (xem bot/intent.py CATEGORY_KEYWORDS) → các cách hỏi
# tiếng Việt tự nhiên tương ứng. Phải khớp đúng slug để gen_category_accessory_samples
# group sản phẩm chính xác theo từng danh mục.
ACCESSORY_CATEGORY_PHRASES = {
    "tai-nghe": ["tai nghe"],
    "sac-khong-day": ["sạc không dây", "đế sạc không dây"],
    "sac-nhanh": ["sạc nhanh", "cục sạc", "củ sạc"],
    "op-lung": ["ốp lưng", "bao da", "case điện thoại"],
    "cap-sac": ["cáp sạc", "dây sạc"],
}


def gen_category_accessory_samples(products_info: list[dict]) -> list[dict]:
    """Hỏi mua phụ kiện theo TỪ KHÓA DANH MỤC (vd "tai nghe", "ốp lưng") — không phải
    theo tên sản phẩm cụ thể. Tên sản phẩm phụ kiện toàn thương hiệu tiếng Anh (vd "Anker
    Soundcore Q20i") nên search theo tên sẽ không khớp — main.py._extract_category() tra
    category slug thật rồi gọi get_products_filtered(category=slug), kèm RAG context theo
    đúng format format_products_context() (KHÔNG có variant detail, khác với product_qa).
    Nếu không sinh mẫu đúng cho các từ khóa này, model sẽ học nhầm theo các mẫu cũ dạy
    "trả lời chung chung" (gen_search_product) — dẫn đến bot bỏ qua context thật khi trả lời."""
    by_category: dict[str, list[dict]] = {}
    for p in products_info:
        slug = p.get("categorySlug")
        if slug in ACCESSORY_CATEGORY_PHRASES:
            by_category.setdefault(slug, []).append(p)

    samples = []
    for slug, phrases in ACCESSORY_CATEGORY_PHRASES.items():
        matched = by_category.get(slug, [])[:4]
        if not matched:
            continue
        context = format_products_context(matched)
        names_prices = ", ".join(f"{m['name']} ({fmt(m['price'])})" for m in matched)

        for phrase in phrases:
            questions = [
                f"Tôi muốn mua {phrase}", f"Shop có {phrase} không?",
                f"PhoneStore có bán {phrase} không?", f"Tìm {phrase} giúp mình",
                f"Cho xem {phrase} đi", f"Có {phrase} không?",
                f"{phrase} giá bao nhiêu?", f"{phrase} còn hàng không?",
                f"Mình cần mua {phrase}", f"Tư vấn {phrase} giúp mình",
            ]
            answer = f"PhoneStore hiện có: {names_prices}. Bạn xem chi tiết trên website nhé!"
            for q in random.sample(questions, k=min(5, len(questions))):
                samples.append(s(q, answer, context=context))

    return samples


def gen_check_order_context() -> list[dict]:
    """Hỏi đơn hàng — kèm context giả lập giống _format_orders()."""
    questions = [
        "Đơn hàng của tôi đâu rồi?", "Kiểm tra đơn hàng giúp tôi",
        "Đặt hàng hôm qua chưa thấy giao?", "Đơn của tôi đang ở đâu?",
        "Trạng thái đơn hàng thế nào?", "Theo dõi đơn hàng như thế nào?",
        "Đơn hàng tôi đặt bao giờ giao?", "Sao chưa thấy ship?",
        "Bao giờ nhận được hàng?", "Xem đơn hàng ở đâu?",
        "Đơn tôi đang xử lý hay đã giao?", "Tra cứu đơn hàng giúp tôi với",
        "Đơn hàng bị hủy rồi à?", "Đơn pending nghĩa là gì?",
        "Đơn của tôi bao giờ được duyệt?", "Xem lịch sử mua hàng ở đâu?",
    ]
    ORDER_SETS = [
        [("DH8231F2", "Đang giao hàng 🚚", 12990000), ("DH7723A1", "Đã giao hàng ✅", 8490000)],
        [("DH1122B7", "Chờ xác nhận ⏳", 24990000)],
        [("DH5566C3", "Đang chuẩn bị 📦", 5990000), ("DH9981D4", "Đã hủy ❌", 15990000)],
        [("DH4410E9", "Đã xác nhận ✅", 9990000)],
    ]
    samples = []
    for codes in ORDER_SETS:
        context = "\n".join(["Đơn hàng gần đây:"] + [f"- #{c}: {st} — {fmt(t)}" for c, st, t in codes])
        first_code, first_status, first_total = codes[0]
        answer = (
            f"Bạn có {len(codes)} đơn hàng gần đây. Đơn #{first_code} đang ở trạng thái: {first_status}, "
            f"tổng {fmt(first_total)}. Bạn xem chi tiết tại mục Đơn hàng nhé!"
        )
        for q in random.sample(questions, k=4):
            samples.append(s(q, answer, context=context))

    # Chưa có đơn hàng nào
    empty_context = "Bạn chưa có đơn hàng nào."
    for q in random.sample(questions, k=4):
        samples.append(s(q, "Bạn chưa có đơn hàng nào trên hệ thống. Bạn có thể tham khảo sản phẩm và đặt hàng ngay nhé!", context=empty_context))

    # Chưa đăng nhập — KHÔNG có context (giống production khi !req.user_token)
    for q in random.sample(questions, k=8):
        samples.append(s(q, "Bạn cần đăng nhập để xem thông tin đơn hàng ạ."))

    return samples


def gen_check_wallet_context() -> list[dict]:
    """Hỏi ví — kèm context giả lập giống dòng 'Số dư ví: X' trong main.py."""
    questions = [
        "Ví tôi còn bao nhiêu tiền?", "Xem số dư ví ở đâu?",
        "Kiểm tra ví điện tử", "Số dư ví PhoneStore của tôi?",
        "Ví tôi còn không?", "Tiền trong ví có hết hạn không?",
        "Hoàn tiền về ví mất bao lâu?", "Nạp bao nhiêu tiền vào ví?",
        "Xem lịch sử giao dịch ví?", "Tôi vừa đổi trả hàng tiền có về ví không?",
    ]
    samples = []
    for bal in [500000, 1250000, 0, 3490000]:
        context = f"Số dư ví: {fmt(bal)}"
        if bal == 0:
            answer = "Ví của bạn hiện chưa có số dư. Bạn có thể nạp tiền qua chuyển khoản hoặc VNPay nhé!"
        else:
            answer = f"Số dư ví của bạn hiện tại là {fmt(bal)}. Bạn có thể dùng để thanh toán đơn hàng nhanh hơn!"
        for q in random.sample(questions, k=4):
            samples.append(s(q, answer, context=context))

    # Chưa đăng nhập — không có context
    for q in random.sample(questions, k=6):
        samples.append(s(q, "Bạn cần đăng nhập để xem số dư ví ạ."))

    return samples


def gen_check_points_context() -> list[dict]:
    """Hỏi điểm thưởng/hạng thành viên — kèm context giả lập giống dòng 'Điểm thưởng hiện
    tại: X điểm. Hạng thành viên: Y.' trong main.py. Trước đó hoàn toàn không có mẫu nào
    cho intent này (tính năng điểm thưởng build sau, chatbot chưa biết) — câu hỏi bị nhận
    nhầm thành hỏi VÍ TIỀN (do từ khóa 'còn bao nhiêu' trùng với check_wallet) hoặc rơi vào
    search vô nghĩa — đã verify bug này qua test thật."""
    questions = [
        "Điểm thưởng của tôi còn bao nhiêu?", "Tôi có bao nhiêu điểm tích lũy?",
        "Mua hàng được tích bao nhiêu điểm?", "Hạng thành viên của tôi là gì?",
        "Làm sao để lên hạng?", "Đổi điểm sang mã giảm giá thế nào?",
        "Điểm thưởng dùng để làm gì?", "Hạng Gold được nhân mấy điểm?",
        "Kiểm tra điểm tích lũy của tôi", "Tôi đang ở hạng nào?",
    ]
    samples = []
    for points, tier in [(0, "bronze"), (320, "bronze"), (1500, "silver"), (8200, "gold"), (25000, "platinum")]:
        context = f"Điểm thưởng hiện tại: {points} điểm. Hạng thành viên: {tier}."
        tier_label = {"bronze": "Bronze", "silver": "Silver", "gold": "Gold", "platinum": "Platinum"}[tier]
        multiplier = {"bronze": 1, "silver": 1.5, "gold": 2, "platinum": 3}[tier]
        if points == 0:
            answer = f"Bạn hiện chưa có điểm thưởng nào, đang ở hạng {tier_label}. Mua hàng và nhận giao thành công để bắt đầu tích điểm nhé!"
        else:
            answer = f"Bạn hiện có {points} điểm thưởng, hạng {tier_label} (x{multiplier} điểm mỗi đơn hàng). Bạn có thể đổi điểm sang mã giảm giá trong trang Tài khoản."
        for q in random.sample(questions, k=4):
            samples.append(s(q, answer, context=context))

    # Chưa đăng nhập — không có context
    for q in random.sample(questions, k=6):
        samples.append(s(q, "Bạn cần đăng nhập để xem điểm thưởng ạ."))

    return samples


def gen_flash_sale_context() -> list[dict]:
    """Hỏi flash sale — kèm context giả lập giống _format_flash_sales()."""
    questions = [
        "Có flash sale không?", "Hôm nay có sale gì không?",
        "Đang có khuyến mãi gì không?", "Có deal hot không?",
        "Sale mấy phần trăm?", "Sản phẩm nào đang giảm giá?",
        "PhoneStore có ưu đãi gì?", "Đang có hot deal không?",
        "Có siêu sale không?", "Flash sale là gì vậy?",
        "Khi nào có flash sale?", "Deal hôm nay là gì?",
        "Khuyến mãi iPhone có không?", "Samsung đang sale không?",
    ]
    FLASH_SETS = [
        [("Flash Sale Cuối Tuần", 20), ("Mega Sale Samsung", 15)],
        [("Sale Sốc iPhone", 10)],
        [("Giảm Giá Mùa Hè", 25)],
    ]
    samples = []
    for items in FLASH_SETS:
        context = "\n".join(["Flash sale đang diễn ra:"] + [f"- {n} — Giảm {d}%" for n, d in items])
        names = ", ".join(f"{n} (giảm {d}%)" for n, d in items)
        answer = f"Hiện đang có: {names}. Nhanh tay đặt hàng trước khi hết ưu đãi nhé!"
        for q in random.sample(questions, k=5):
            samples.append(s(q, answer, context=context))

    no_sale_context = "Hiện không có flash sale nào đang chạy."
    for q in random.sample(questions, k=6):
        samples.append(s(q, "Hiện không có flash sale nào đang chạy. Bạn theo dõi website để cập nhật khuyến mãi mới nhé!", context=no_sale_context))

    return samples


# ══════════════════════════════════════════════════════════════════════
# Tư vấn / so sánh / multi-turn — không nhận tools_context lúc chạy thật
# (giữ nguyên logic cũ, chỉ đổi sang nhận products_info nếu cần tên)
# ══════════════════════════════════════════════════════════════════════

def gen_recommend() -> list[dict]:
    ANSWERS = [
        "Bạn cho mình biết thêm nhu cầu cụ thể nhé — dùng để chụp ảnh, chơi game, hay dùng văn phòng? Ngân sách tầm bao nhiêu? Mình sẽ gợi ý chính xác hơn!",
        "Để gợi ý phù hợp, bạn cho mình biết: tầm giá, hãng ưa thích, và ưu tiên tính năng gì (camera/pin/hiệu năng)? Mình tư vấn ngay!",
        "PhoneStore có nhiều dòng máy tốt. Cho mình biết ngân sách và nhu cầu sử dụng, mình sẽ đề xuất 2-3 máy phù hợp nhất nhé!",
        "Tốt nhất là tùy nhu cầu của bạn. Bạn cần điện thoại để làm gì chủ yếu? Camera, gaming, pin lâu, hay giá rẻ?",
    ]
    COMPARE_ANSWERS = [
        "Cả hai đều là lựa chọn tốt! Tùy nhu cầu: nếu bạn trong hệ sinh thái Apple thì iPhone phù hợp hơn; nếu muốn đa dạng tính năng và giá tốt thì Samsung/Android là lựa chọn hay.",
        "Rất khó để nói hơn/thua vì mỗi hãng có thế mạnh riêng. Bạn đang so sánh tầm giá bao nhiêu? Mình tư vấn cụ thể hơn nhé!",
        "Mỗi hãng có ưu/nhược điểm riêng. Bạn có thể vào mục So sánh trên website để xem chi tiết từng tiêu chí nhé!",
    ]
    BRANDS_VN = ["iPhone", "Samsung", "Xiaomi", "OPPO", "Vivo", "Realme"]
    questions = [
        "Nên mua điện thoại nào?", "Tư vấn mua máy giúp mình",
        "Điện thoại nào tốt nhất hiện nay?", "Gợi ý máy tốt đi",
        "Mình muốn mua máy mới, nên chọn gì?",
        "Điện thoại chụp ảnh đẹp nhất?",
        "Máy nào pin trâu nhất?", "Điện thoại chơi game tốt nhất?",
        "Máy nào đáng mua nhất?", "iPhone hay Samsung thì nên mua?",
        "iPhone với Xiaomi cái nào tốt hơn?", "Samsung hay OPPO?",
        "Mua máy cho học sinh nên chọn gì?", "Tặng sinh nhật bạn gái thì mua máy gì?",
        "Máy đầu tiên nên mua gì?", "Flagship tốt nhất tầm 20 triệu?",
        "Máy tầm trung tốt nhất hiện tại?", "Điện thoại giá rẻ tốt nhất?",
        "Máy nào có camera đẹp nhất?", "Chọn máy gaming thì nên mua gì?",
        "Điện thoại 5G giá rẻ nào tốt?", "Máy nào RAM nhiều nhất?",
        "Máy nào dùng bền nhất?",
    ]
    for brand in BRANDS_VN:
        questions.extend([
            f"{brand} nào tốt nhất?", f"Mua {brand} nào ngon nhất hiện tại?",
            f"Dòng {brand} nào đáng mua?",
        ])

    samples = []
    for q in questions:
        if "hay" in q or "với" in q or "so" in q.lower():
            samples.append(s(q, random.choice(COMPARE_ANSWERS)))
        else:
            samples.append(s(q, random.choice(ANSWERS)))
    return samples


def gen_product_advice(product_names: list[str]) -> list[dict]:
    """Hỏi tư vấn cụ thể về sản phẩm — sinh từ tên sản phẩm thật."""
    CAMERA_ANS = [
        "Camera là điểm mạnh của máy này! Bạn có thể xem mẫu ảnh thực tế trên trang chi tiết sản phẩm nhé.",
        "Máy chụp ảnh khá tốt trong phân khúc. Nếu ưu tiên camera, bạn nên thử trực tiếp tại cửa hàng!",
        "Ảnh chụp bởi máy này được đánh giá tốt. Chi tiết specs camera xem trong trang sản phẩm nhé.",
    ]
    GAMING_ANS = [
        "Máy này có chip mạnh, chơi game khá mượt. Bạn xem chi tiết cấu hình RAM/chip trên trang sản phẩm để so sánh nhé.",
        "Hiệu năng gaming ổn trong tầm giá. Để biết chính xác, bạn xem specs chi tiết trên website nhé!",
        "Chip và RAM của máy đủ để chơi hầu hết game phổ biến. Xem thêm chi tiết trên trang sản phẩm nhé.",
    ]
    BATTERY_ANS = [
        "Pin máy này khá trâu! Bạn xem thông số pin cụ thể trên trang sản phẩm để biết dung lượng chính xác.",
        "Dung lượng pin tốt, dùng cả ngày thoải mái. Xem specs pin trên trang sản phẩm nhé!",
        "Máy có pin lớn, phù hợp dùng nhiều. Chi tiết xem trên trang sản phẩm nhé.",
    ]
    GENERAL_ANS = [
        "Đây là sản phẩm tốt trong phân khúc! Bạn xem chi tiết specs và đánh giá trên trang sản phẩm nhé.",
        "Máy này được nhiều khách hàng đánh giá tốt. Bạn xem chi tiết trên website để quyết định nhé!",
        "Rất đáng cân nhắc! Bạn vào trang sản phẩm xem đầy đủ thông số và đánh giá của người dùng nhé.",
    ]

    samples = []
    for name in product_names:
        if not name or len(name) < 3:
            continue
        qs = [
            (f"{name} chụp ảnh đẹp không?", CAMERA_ANS),
            (f"{name} chơi game được không?", GAMING_ANS),
            (f"{name} pin có trâu không?", BATTERY_ANS),
            (f"{name} có đáng mua không?", GENERAL_ANS),
            (f"Đánh giá {name} thế nào?", GENERAL_ANS),
            (f"{name} dùng có tốt không?", GENERAL_ANS),
        ]
        for q, ans_list in random.sample(qs, k=3):
            samples.append(s(q, random.choice(ans_list)))
    return samples


def gen_product_pair_comparison(products_info: list[dict]) -> list[dict]:
    """So sánh 2 sản phẩm cụ thể từ DB — PHẢI kèm context thật (tên+giá cả 2 máy). Nếu
    không, model học thuộc câu trả lời chung chung kiểu "Cả hai đều là lựa chọn tốt..."
    không dùng dữ liệu thật, dù main.py đã sửa để tìm đúng cả 2 sản phẩm riêng biệt khi hỏi
    so sánh (_extract_compare_targets) — đã verify bug này qua test thật: hỏi so sánh 2 máy
    cụ thể, bot không đưa ra số liệu nào, chỉ hỏi lại nhu cầu chung chung."""
    products = [p for p in products_info if p.get("categoryType", "phone") == "phone" and p.get("name")]
    samples = []
    pairs_done = set()
    for _ in range(min(60, len(products) * (len(products) - 1) // 2)):
        if len(products) < 2:
            break
        a, b = random.sample(products, 2)
        key = tuple(sorted([a["name"], b["name"]]))
        if key in pairs_done:
            continue
        pairs_done.add(key)
        q = random.choice([
            f"{a['name']} hay {b['name']} tốt hơn?", f"Nên mua {a['name']} hay {b['name']}?",
            f"So sánh {a['name']} với {b['name']} giúp mình", f"{a['name']} vs {b['name']} cái nào ngon hơn?",
            f"Giữa {a['name']} và {b['name']} nên chọn cái nào?",
        ])
        context = format_products_context([a, b])
        answer = (
            f"{a['name']} ({fmt(a['price'])}) và {b['name']} ({fmt(b['price'])})"
            " đều là lựa chọn tốt. Bạn xem thêm thông số chi tiết từng máy trên website để so sánh kỹ hơn nhé!"
        )
        samples.append(s(q, answer, context=context))
    return samples


def gen_multi_turn_examples(product_names: list[str]) -> list[dict]:
    """Một số mẫu multi-turn để bot học cách xử lý context follow-up.
    KHÔNG sinh mẫu "X hay Y tốt hơn?" ở đây — gen_product_pair_comparison() đã làm đúng
    việc này với context thật + lọc chỉ điện thoại. Sinh lại pattern y hệt ở đây nhưng
    KHÔNG context (như bản cũ) sẽ dạy model 2 hành vi mâu thuẫn cho cùng 1 câu hỏi, và còn
    lẫn cả phụ kiện vào cặp so sánh (vd "AirPods Pro 2 hay OPPO Reno 11 Pro") — đã phát
    hiện qua kiểm tra dataset trước khi fine-tune."""
    samples = []
    for name in random.sample(product_names[:30], min(10, len(product_names))):
        samples.append(s(
            f"Cho hỏi {name} màu nào đẹp nhất?",
            f"Màu sắc phụ thuộc sở thích cá nhân bạn nhé! {name} thường có nhiều màu đẹp. Bạn thích tone tối hay sáng?",
        ))
        samples.append(s(
            f"Mình muốn mua {name} làm quà tặng",
            f"Chọn {name} làm quà rất ý nghĩa! Bạn muốn mua màu gì và cần hỗ trợ gì thêm — gói quà, khắc tên, hay card chúc mừng không?",
        ))

    return samples


# ══════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════

def main():
    print(f"Kết nối MongoDB: {MONGO_URI}")
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    db = client.get_default_database()

    try:
        db.command("ping")
        print("✅ Kết nối MongoDB thành công")
    except Exception as e:
        print(f"❌ Không kết nối được MongoDB: {e}")
        print("   Chạy khi Node.js server đang bật.")
        return

    all_samples: list[dict] = []

    print("📦 Lấy thông tin sản phẩm thật từ DB...")
    products_info = fetch_product_info(db)
    print(f"   → {len(products_info)} sản phẩm có variant hợp lệ")
    product_names = [p["name"] for p in products_info]

    groups = [
        ("product_qa",       gen_product_samples(products_info)),
        ("named_search",     gen_named_search_samples(products_info)),
        ("price_range",      gen_price_range(products_info)),
        ("search_product",   gen_search_product(products_info)),
        ("category_accessory", gen_category_accessory_samples(products_info)),
        ("check_order",      gen_check_order_context()),
        ("check_wallet",     gen_check_wallet_context()),
        ("check_points",     gen_check_points_context()),
        ("flash_sale",       gen_flash_sale_context()),
        ("greeting",         gen_greeting()),
        ("goodbye",          gen_goodbye()),
        ("faq_shipping",     gen_faq_shipping()),
        ("faq_warranty",     gen_faq_warranty()),
        ("faq_payment",      gen_faq_payment()),
        ("contact_info",     gen_contact_info()),
        ("return_product",   gen_return_product()),
        ("cancel_order",      gen_cancel_order()),
        ("validate_coupon",  gen_validate_coupon()),
        ("coupon_list",      gen_coupon_list()),
        ("new_arrivals",     gen_new_arrivals(products_info)),
        ("bestsellers",      gen_bestsellers(products_info)),
        ("recommend",        gen_recommend()),
        ("product_advice",   gen_product_advice(product_names)),
        ("product_compare",  gen_product_pair_comparison(products_info)),
        ("multi_turn",       gen_multi_turn_examples(product_names)),
        ("fallback",         gen_fallback()),
    ]

    print("📋 Sinh samples theo từng nhóm intent...")
    for name, group in groups:
        all_samples.extend(group)
        print(f"   → {len(group):3d} samples [{name}]")

    random.shuffle(all_samples)

    # Dedup by user message
    seen = set()
    deduped = []
    for sample in all_samples:
        m = re.search(r"<\|im_start\|>user\n(.+?)<\|im_end\|>", sample["text"])
        key = m.group(1).strip().lower() if m else sample["text"][:80]
        if key not in seen:
            seen.add(key)
            deduped.append(sample)

    print(f"\n✅ Tổng {len(all_samples)} samples, sau dedup: {len(deduped)}")

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for sample in deduped:
            f.write(json.dumps(sample, ensure_ascii=False) + "\n")

    print(f"📁 Đã lưu → {OUTPUT_FILE}")
    print(f"\nPhân phối intents:")
    for name, group in groups:
        print(f"  {name:20s}: {len(group)} mẫu")
    print(f"\n🚀 Dùng file này trong Cell 3 Colab thay train.jsonl. Target ≥ 1000 samples, ≥ 8 epochs.")
    client.close()


if __name__ == "__main__":
    main()
