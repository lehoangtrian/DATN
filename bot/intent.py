import re
import unicodedata
from typing import Tuple


def _normalize(text: str) -> str:
    """Lowercase + strip Vietnamese diacritics for accent-insensitive matching."""
    t = text.lower().replace('đ', 'd').replace('Đ', 'd')
    nfkd = unicodedata.normalize('NFKD', t)
    return ''.join(c for c in nfkd if not unicodedata.combining(c))


def _kw_match(keyword: str, padded_norm: str) -> bool:
    """Whole-word match on normalized text."""
    return f" {_normalize(keyword)} " in padded_norm


INTENTS = {
    "greeting": {
        "keywords": [
            "xin chào", "chào", "hello", "hi", "hey", "alo",
            "cho hỏi", "hỏi chút", "bạn ơi", "giúp tôi",
            "giúp mình", "tư vấn", "hỗ trợ", "xin hỏi",
            "có ai không", "phục vụ", "shop ơi",
        ],
        "weight": 1.0,
        "threshold": 0.05,
    },
    "check_order": {
        "keywords": [
            "đơn hàng", "đơn của tôi", "kiểm tra đơn", "trạng thái đơn",
            "đặt hàng", "đơn mua", "order", "theo dõi đơn",
            "đơn đâu rồi", "tôi đặt", "bao giờ giao",
            "xem đơn", "lịch sử mua", "đã mua gì",
        ],
        "weight": 1.3,
        "threshold": 0.07,
    },
    "price_range": {
        "keywords": [
            "tầm giá", "tầm tiền", "ngân sách", "tầm",
            "dưới", "từ", "khoảng", "budget",
            "triệu", "tr", "nghìn", "k",
            "giá rẻ", "rẻ nhất", "giá tốt", "tiết kiệm",
            "mức giá", "giá từ", "bao nhiêu tiền",
        ],
        "weight": 1.4,
        "threshold": 0.06,
    },
    "search_product": {
        "keywords": [
            "tìm", "kiếm", "có bán", "bán không", "điện thoại",
            "iphone", "samsung", "xiaomi", "oppo", "vivo", "realme",
            "giá", "mua", "model", "máy", "sản phẩm", "xem thêm",
            "cho xem", "có không", "muốn mua", "cần mua",
            "pixel", "oneplus", "nokia", "motorola", "tecno",
        ],
        "weight": 1.0,
        "threshold": 0.03,
    },
    "product_detail": {
        "keywords": [
            "chi tiết", "thông số", "specs", "cấu hình", "màu sắc",
            "màu nào", "còn màu", "còn hàng", "hết hàng",
            "dung lượng", "bộ nhớ", "ram", "pin", "camera",
            "màn hình", "kích thước", "trọng lượng",
            "variant", "phiên bản", "tồn kho", "mua được không",
        ],
        "weight": 1.3,
        "threshold": 0.06,
    },
    "recommend_product": {
        "keywords": [
            "tư vấn", "nên mua", "loại nào tốt", "máy nào tốt",
            "điện thoại nào tốt", "gợi ý", "đề xuất", "giới thiệu",
            "bán chạy", "phổ biến", "hot", "nổi bật",
            "nên chọn", "phù hợp", "sản phẩm tốt", "tư vấn giúp",
            "mua máy gì", "chọn máy gì",
            "tầm giá", "tầm tiền", "ngân sách", "khoảng bao nhiêu", "tầm",
        ],
        "weight": 1.2,
        "threshold": 0.05,
    },
    "goodbye": {
        "keywords": [
            "cảm ơn", "cám ơn", "thanks", "thank you",
            "bye", "tạm biệt", "ok thôi", "thôi nhé",
            "mình biết rồi", "hẹn gặp lại", "ok bye", "tạm biệt nhé",
        ],
        "weight": 1.0,
        "threshold": 0.08,
    },
    "check_wallet": {
        "keywords": [
            "ví", "số dư", "tiền trong ví", "wallet", "balance",
            "còn bao nhiêu", "ví điện tử", "nạp tiền", "rút tiền",
            "kiểm tra ví", "xem ví", "tài khoản ví",
        ],
        "weight": 1.2,
        "threshold": 0.08,
    },
    "validate_coupon": {
        "keywords": [
            "mã giảm giá", "coupon", "voucher", "mã khuyến mãi",
            "discount", "mã code", "mã ưu đãi",
            "code giảm", "kiểm tra mã", "mã có hợp lệ không",
            "dùng được không", "còn dùng được", "mã này còn",
        ],
        "weight": 1.2,
        "threshold": 0.08,
    },
    "flash_sale": {
        "keywords": [
            "flash sale", "sale", "khuyến mãi", "ưu đãi",
            "hot deal", "deal", "siêu sale", "giảm sâu",
            "đang sale", "đang khuyến mãi", "có khuyến mãi gì",
            "hàng giảm giá", "sản phẩm sale", "giảm mạnh",
        ],
        "weight": 1.1,
        "threshold": 0.07,
    },
    "faq_shipping": {
        "keywords": [
            "giao hàng", "ship", "vận chuyển", "phí ship", "freeship",
            "miễn phí ship", "giao nhanh", "giao hàng bao lâu",
            "bao lâu giao", "giao trong ngày", "thời gian giao",
            "phí vận chuyển",
        ],
        "weight": 1.0,
        "threshold": 0.07,
    },
    "faq_warranty": {
        "keywords": [
            "bảo hành", "warranty", "lỗi", "hỏng", "sửa chữa",
            "bảo hành bao lâu", "tháng bảo hành",
            "chính sách bảo hành", "bị lỗi", "hàng lỗi", "máy lỗi",
        ],
        "weight": 1.1,
        "threshold": 0.08,
    },
    "faq_payment": {
        "keywords": [
            "thanh toán", "trả tiền", "cod", "chuyển khoản",
            "vnpay", "trả góp", "momo", "zalopay",
            "hình thức thanh toán", "qua thẻ", "thẻ tín dụng",
        ],
        "weight": 1.0,
        "threshold": 0.07,
    },
    "contact_info": {
        "keywords": [
            "hotline", "số điện thoại", "liên hệ", "địa chỉ",
            "cửa hàng", "contact", "gọi điện", "nhân viên",
            "hỗ trợ trực tiếp", "gặp nhân viên", "email",
        ],
        "weight": 1.2,
        "threshold": 0.09,
    },
    "return_product": {
        "keywords": [
            "trả hàng", "hoàn tiền", "refund", "trả lại",
            "đổi hàng", "đổi máy", "muốn trả", "cần đổi",
            "cách trả", "quy trình trả", "đổi trả",
        ],
        "weight": 1.2,
        "threshold": 0.09,
    },
}

BRANDS = [
    "iphone", "samsung", "xiaomi", "oppo", "vivo",
    "realme", "pixel", "oneplus", "nokia", "motorola", "tecno",
]

# Map normalized brand name → tên thật để gọi API
BRAND_NAME_MAP = {
    "iphone": "apple",
    "apple": "apple",
    "samsung": "samsung",
    "xiaomi": "xiaomi",
    "oppo": "oppo",
    "vivo": "vivo",
    "realme": "realme",
    "pixel": "google",
    "google": "google",
    "oneplus": "oneplus",
    "nokia": "nokia",
    "motorola": "motorola",
    "tecno": "tecno",
}


def _extract_coupon_code(text: str) -> str | None:
    for trigger in ['mã', 'ma', 'code', 'voucher', 'coupon']:
        m = re.search(rf'(?i)\b{trigger}\b\s+([A-Za-z][A-Za-z0-9]{{2,19}})', text)
        if m:
            return m.group(1).upper()
    raw = re.findall(r'\b[A-Z][A-Z0-9]{3,19}\b', text.upper())
    with_digit = [x for x in raw if any(c.isdigit() for c in x)]
    return (with_digit or raw or [None])[0]


def _extract_price_range(text: str) -> tuple[int | None, int | None]:
    """Trích xuất khoảng giá từ câu hỏi. Trả về (min_price, max_price) tính bằng VND."""
    norm = _normalize(text)

    # Pattern: "dưới X triệu", "dưới X tr"
    m = re.search(r'(?:duoi|tu|den)\s+(\d+(?:[.,]\d+)?)\s*(?:trieu|tr\b)', norm)
    if m:
        val = float(m.group(1).replace(',', '.')) * 1_000_000
        return (None, int(val))

    # Pattern: "từ X đến Y triệu"
    m = re.search(r'tu\s+(\d+(?:[.,]\d+)?)\s*(?:den|toi)\s+(\d+(?:[.,]\d+)?)\s*(?:trieu|tr\b)', norm)
    if m:
        lo = float(m.group(1).replace(',', '.')) * 1_000_000
        hi = float(m.group(2).replace(',', '.')) * 1_000_000
        return (int(lo), int(hi))

    # Pattern: "tầm X triệu", "khoảng X triệu", "X triệu"
    m = re.search(r'(?:tam|khoang|tầm|khoảng)?\s*(\d+(?:[.,]\d+)?)\s*(?:trieu|tr\b)', norm)
    if m:
        val = float(m.group(1).replace(',', '.')) * 1_000_000
        # "tầm X triệu" → ±20%
        return (int(val * 0.8), int(val * 1.2))

    return (None, None)


def _extract_brand(text: str) -> str | None:
    """Trích xuất tên brand từ text (trả về brand slug để gọi API)."""
    norm = _normalize(text)
    for brand in BRANDS:
        if f" {brand} " in f" {norm} ":
            return BRAND_NAME_MAP.get(brand)
    return None


# Noise patterns (normalized form) to strip from end of extracted query
_NOISE_SUFFIX = re.compile(
    r'\s+(bao nhieu|gia bao nhieu|co khong|ban khong|con hang khong|het hang khong'
    r'|khong|nao|gi|co|duoc|ban|o dau|nhu the nao|thi sao|gia|nhat'
    r'|con hang|het hang|mau gi|mau nao|con mau|con khong|gia bao'
    r'|specs|thong so|chi tiet|mua duoc khong|mua duoc)\s*$'
)

_SEARCH_STOPWORDS_NORM = [_normalize(sw) for sw in [
    "tìm kiếm", "có bán", "bán không", "cho tôi xem", "cho tôi", "tôi muốn",
    "bao nhiêu", "được không", "được", "vui lòng", "điện thoại",
    "sản phẩm", "muốn mua", "cần mua", "muốn", "cần", "shop",
    "tìm", "kiếm", "cho xem", "hỏi", "nhé", "nha", "ạ", "bạn ơi", "ơi",
    "giá", "mua", "xem", "có", "vậy", "thế", "nhỉ", "chi tiết",
    "thông số", "còn hàng không", "còn không", "tồn kho",
]]


def _extract_search_query(text: str) -> str:
    """Trả về query tìm kiếm sản phẩm từ câu người dùng.
    Giữ nguyên dấu tiếng Việt để gửi API, chỉ dùng normalized để matching."""
    norm = _normalize(text.lower())

    # Ưu tiên brand + model — tìm vị trí brand trong norm, lấy slice từ text gốc
    for brand in BRANDS:
        if brand in norm:
            idx = norm.find(brand)
            raw_slice = text[idx:idx + 40].strip()
            # Xóa trailing noise bằng normalized version của slice
            norm_slice = _normalize(raw_slice)
            norm_clean = _NOISE_SUFFIX.sub('', norm_slice).strip()
            norm_clean = re.sub(r'[?!.,;:]+$', '', norm_clean).strip()
            if not norm_clean:
                return brand
            # Lấy đúng số từ từ raw_slice — tránh kéo theo noise words
            n_words = len(norm_clean.split())
            result = ' '.join(raw_slice.split()[:n_words]).strip()
            result = re.sub(r'[?!.,;:]+$', '', result).strip()
            return result or brand

    # Generic: xóa stopwords khỏi normalized, lấy phần còn lại
    q_norm = norm
    for sw in sorted(_SEARCH_STOPWORDS_NORM, key=len, reverse=True):
        q_norm = re.sub(rf'(?<!\w){re.escape(sw)}(?!\w)', ' ', q_norm)
    q_norm = re.sub(r'\s+', ' ', q_norm).strip()
    q_norm = _NOISE_SUFFIX.sub('', q_norm).strip()
    q_norm = re.sub(r'[?!.,;:]+$', '', q_norm).strip()
    return q_norm if len(q_norm) > 2 else ""


def detect_intent(text: str) -> Tuple[str, float, dict]:
    """Returns (intent_name, confidence_score, extras)."""
    clean = re.sub(r'[?!.,;:]+', ' ', text.strip())
    normalized = _normalize(clean)
    padded = f" {normalized} "

    best_intent = "fallback"
    best_score = 0.0

    for intent_name, config in INTENTS.items():
        keywords = config["keywords"]
        if not keywords:
            continue
        matched = sum(1 for kw in keywords if _kw_match(kw, padded))
        if matched == 0:
            continue
        score = (matched / len(keywords)) * config["weight"]
        if score >= config["threshold"] and score > best_score:
            best_score = score
            best_intent = intent_name

    extras: dict = {}
    if best_intent == "validate_coupon":
        extras["coupon_code"] = _extract_coupon_code(text)
    elif best_intent in ("search_product", "recommend_product", "product_detail"):
        extras["query"] = _extract_search_query(text)
        extras["brand"] = _extract_brand(text)
    elif best_intent == "price_range":
        min_p, max_p = _extract_price_range(text)
        extras["min_price"] = min_p
        extras["max_price"] = max_p
        extras["brand"] = _extract_brand(text)
        extras["query"] = _extract_search_query(text)

    return best_intent, round(best_score, 4), extras
