"""Vietnamese response builder — one handler per intent."""

from actions import (
    get_orders, search_products, get_product_detail,
    get_products_filtered, get_wallet, validate_coupon, get_flash_sales,
    get_active_coupons,
)
from intent import filter_exact_match

_BRANDS = ["iphone", "samsung", "xiaomi", "oppo", "vivo", "realme", "pixel", "oneplus", "nokia", "motorola"]


def _fmt_price(amount) -> str:
    try:
        return f"{int(amount):,}₫".replace(",", ".")
    except Exception:
        return str(amount)


def _get_price(p: dict) -> int:
    for field in ("price", "minPrice", "salePrice"):
        v = p.get(field)
        if v:
            try:
                return int(v)
            except Exception:
                pass
    cv = p.get("cheapestVariant") or {}
    for field in ("salePrice", "price"):
        v = cv.get(field)
        if v:
            try:
                return int(v)
            except Exception:
                pass
    return 0


STATUS_MAP = {
    "pending": "Chờ xác nhận ⏳",
    "confirmed": "Đã xác nhận ✅",
    "preparing": "Đang chuẩn bị 📦",
    "shipping": "Đang giao hàng 🚚",
    "delivered": "Đã giao hàng ✅",
    "cancelled": "Đã hủy ❌",
    "return_requested": "Yêu cầu trả hàng 🔄",
    "returned": "Đã trả hàng 🔄",
}


# ── Greeting ──────────────────────────────────────────────────────────────────

def handle_greeting() -> dict:
    return {
        "text": (
            "Xin chào! Tôi là trợ lý AI của PhoneStore.\n"
            "Tôi có thể giúp bạn:\n"
            "• Kiểm tra đơn hàng & trạng thái giao hàng\n"
            "• Tìm sản phẩm, xem thông số, kiểm tra tồn kho\n"
            "• Xem khuyến mãi & flash sale\n"
            "• Kiểm tra số dư ví, mã giảm giá\n"
            "• Giải đáp về giao hàng, bảo hành, đổi trả\n\n"
            "Bạn cần hỗ trợ gì ạ?"
        ),
        "actions": [
            {"label": "Xem đơn hàng", "type": "trigger_intent", "payload": "kiểm tra đơn hàng"},
            {"label": "Tìm sản phẩm", "type": "trigger_intent", "payload": "tư vấn điện thoại"},
            {"label": "Khuyến mãi hôm nay", "type": "trigger_intent", "payload": "có khuyến mãi gì không"},
        ],
    }


# ── Check order ───────────────────────────────────────────────────────────────

async def handle_check_order(token: str | None) -> dict:
    if not token:
        return {
            "text": "Bạn cần đăng nhập để xem thông tin đơn hàng ạ.",
            "actions": [{"label": "Đăng nhập ngay", "type": "navigate", "payload": "/login"}],
        }

    data = await get_orders(token)
    if not data or not data.get("success"):
        return {
            "text": "Không thể tải danh sách đơn hàng lúc này. Vui lòng thử lại sau.",
            "actions": [{"label": "Xem trang đơn hàng", "type": "navigate", "payload": "/orders"}],
        }

    orders = data.get("orders") or data.get("data") or []
    if not orders:
        return {
            "text": "Bạn chưa có đơn hàng nào. Hãy khám phá các sản phẩm của PhoneStore nhé!",
            "actions": [{"label": "Xem sản phẩm", "type": "navigate", "payload": "/products"}],
        }

    recent = orders[:3]
    lines = []
    for o in recent:
        code = o.get("orderCode") or str(o.get("_id", ""))[:8]
        status = STATUS_MAP.get(o.get("status", ""), o.get("status", ""))
        total = _fmt_price(o.get("totalPrice") or o.get("grandTotal") or 0)
        lines.append(f"• #{code} — {status} — {total}")

    count_text = f"{len(orders)} đơn hàng" if len(orders) > 1 else "1 đơn hàng"
    text = f"Bạn có {count_text}. {min(3, len(orders))} đơn gần nhất:\n" + "\n".join(lines)
    return {
        "text": text,
        "actions": [{"label": "Xem tất cả đơn hàng", "type": "navigate", "payload": "/orders"}],
    }


# ── Search product ────────────────────────────────────────────────────────────

def _format_variants(variants: list) -> str:
    """Format danh sách variants thành text ngắn gọn."""
    if not variants:
        return ""
    lines = []
    for v in variants[:6]:
        color = v.get("color", "")
        storage = v.get("storage", "")
        label = " / ".join(filter(None, [color, storage]))
        price = _fmt_price(v.get("salePrice") or v.get("price") or 0)
        stock = v.get("stock", 0)
        status = "✅" if stock > 0 else "❌ hết hàng"
        lines.append(f"  {label}: {price} {status}")
    return "\n".join(lines)


async def handle_search_product(query: str) -> dict:
    if not query or len(query.strip()) < 2:
        return {
            "text": "Bạn muốn tìm sản phẩm gì ạ? Hãy cho tôi biết tên điện thoại hoặc thương hiệu nhé.",
            "actions": [{"label": "Xem tất cả sản phẩm", "type": "navigate", "payload": "/products"}],
        }

    data = await search_products(query.strip())
    products = (data.get("products") or data.get("data") or []) if data else []
    products = filter_exact_match(products, query)

    if not products:
        return {
            "text": f"Không tìm thấy sản phẩm nào khớp với '{query}'.\nThử tìm với từ khóa khác hoặc xem toàn bộ sản phẩm nhé.",
            "actions": [{"label": "Xem tất cả sản phẩm", "type": "navigate", "payload": "/products"}],
        }

    # Nếu tìm được 1-2 kết quả → lấy chi tiết sản phẩm đầu tiên để hiển thị variants
    if len(products) <= 2:
        first = products[0]
        slug = first.get("slug", "")
        detail = await get_product_detail(slug) if slug else None
        detail_data = (detail.get("data") or detail.get("product") or {}) if detail else {}
        variants = detail_data.get("variants") or []

        name = first.get("name", "")
        price = _fmt_price(_get_price(first))
        text = f"📱 {name}\nGiá từ: {price}\n"
        if first.get("rating"):
            text += f"⭐ {first['rating']:.1f}/5"
            if first.get("reviewCount"):
                text += f" ({first['reviewCount']} đánh giá)"
            text += "\n"

        variant_text = _format_variants(variants)
        if variant_text:
            text += f"\nCác phiên bản:\n{variant_text}"
        else:
            text += "\nVui lòng xem chi tiết để kiểm tra màu sắc và tồn kho."

        actions = []
        if slug:
            actions.append({"label": "Xem chi tiết", "type": "navigate", "payload": f"/products/{slug}"})
        actions.append({"label": "Xem tất cả sản phẩm", "type": "navigate", "payload": "/products"})
        return {"text": text, "actions": actions}

    # Nhiều kết quả → liệt kê danh sách
    lines = [f"• {p.get('name', '')} — từ {_fmt_price(_get_price(p))}"
             for p in products[:4]]
    text = f"Tìm thấy {len(products)} sản phẩm cho '{query}':\n" + "\n".join(lines)

    actions = []
    for p in products[:3]:
        slug = p.get("slug", "")
        name = p.get("name", "Xem chi tiết")
        if slug:
            actions.append({"label": name[:25], "type": "navigate", "payload": f"/products/{slug}"})
    actions.append({"label": "Xem thêm kết quả", "type": "navigate", "payload": f"/search?q={query}"})
    return {"text": text, "actions": actions}


# ── Product detail (khi user hỏi specs/màu/tồn kho cụ thể) ───────────────────

async def handle_product_detail(query: str) -> dict:
    """Tìm sản phẩm rồi lấy chi tiết đầy đủ từ API."""
    if not query or len(query.strip()) < 2:
        return {
            "text": "Bạn muốn xem chi tiết sản phẩm nào ạ? Hãy cho tôi biết tên điện thoại nhé.",
            "actions": [{"label": "Xem tất cả sản phẩm", "type": "navigate", "payload": "/products"}],
        }

    data = await search_products(query.strip(), limit=3)
    products = (data.get("products") or data.get("data") or []) if data else []
    products = filter_exact_match(products, query)

    if not products:
        return {
            "text": f"Không tìm thấy sản phẩm '{query}' trong kho.\nThử tìm với tên khác hoặc xem toàn bộ sản phẩm.",
            "actions": [{"label": "Xem tất cả sản phẩm", "type": "navigate", "payload": "/products"}],
        }

    first = products[0]
    slug = first.get("slug", "")
    detail = await get_product_detail(slug) if slug else None
    detail_data = (detail.get("data") or detail.get("product") or {}) if detail else {}
    variants = detail_data.get("variants") or []
    specs = detail_data.get("specs") or {}

    name = first.get("name", "Sản phẩm")
    text = f"📱 {name}\n"
    text += f"Giá từ: {_fmt_price(_get_price(first))}\n"

    if first.get("rating"):
        text += f"⭐ {first['rating']:.1f}/5"
        if first.get("reviewCount"):
            text += f" ({first['reviewCount']} đánh giá)"
        text += "\n"

    # Specs nổi bật
    spec_lines = []
    for key, label in [("ram", "RAM"), ("storage", "Bộ nhớ"), ("battery", "Pin"), ("screen", "Màn hình")]:
        val = specs.get(key)
        if val:
            spec_lines.append(f"• {label}: {val}")
    if spec_lines:
        text += "\nThông số:\n" + "\n".join(spec_lines)

    # Variants với tồn kho
    variant_text = _format_variants(variants)
    if variant_text:
        text += f"\n\nPhiên bản & Tồn kho:\n{variant_text}"
    elif variants:
        in_stock = sum(1 for v in variants if v.get("stock", 0) > 0)
        text += f"\n\n{len(variants)} phiên bản, còn hàng: {in_stock}"

    actions = []
    if slug:
        actions.append({"label": "Mua ngay", "type": "navigate", "payload": f"/products/{slug}"})
    if len(products) > 1:
        actions.append({"label": "Xem thêm kết quả", "type": "navigate", "payload": f"/search?q={query}"})
    return {"text": text, "actions": actions}


# ── Price range ───────────────────────────────────────────────────────────────

async def handle_price_range(
    min_price: int | None,
    max_price: int | None,
    brand: str | None = None,
) -> dict:
    """Tìm sản phẩm theo khoảng giá thực tế từ server."""
    data = await get_products_filtered(
        brand=brand, product_type="phone", min_price=min_price, max_price=max_price, limit=6
    )
    products = []
    if data:
        products = data.get("products") or data.get("data") or []

    # Mô tả ngân sách
    if min_price and max_price:
        budget_text = f"từ {_fmt_price(min_price)} đến {_fmt_price(max_price)}"
    elif max_price:
        budget_text = f"dưới {_fmt_price(max_price)}"
    elif min_price:
        budget_text = f"từ {_fmt_price(min_price)}"
    else:
        budget_text = "theo yêu cầu"

    brand_text = f" {brand.upper()}" if brand else ""

    if not products:
        return {
            "text": (
                f"Hiện PhoneStore chưa có điện thoại{brand_text} {budget_text} trong kho.\n"
                "Bạn thử xem tất cả sản phẩm hoặc mở rộng khoảng giá nhé."
            ),
            "actions": [{"label": "Xem tất cả sản phẩm", "type": "navigate", "payload": "/products"}],
        }

    lines = []
    for p in products[:5]:
        name = p.get("name", "")
        price = _fmt_price(_get_price(p))
        lines.append(f"• {name} — {price}")

    text = f"Điện thoại{brand_text} {budget_text} tại PhoneStore:\n" + "\n".join(lines)

    actions = []
    for p in products[:3]:
        slug = p.get("slug", "")
        name = p.get("name", "Xem chi tiết")
        if slug:
            actions.append({"label": name[:25], "type": "navigate", "payload": f"/products/{slug}"})

    # Link xem thêm với filter
    filter_url = "/products?"
    if brand:
        filter_url += f"brand={brand}&"
    if max_price:
        filter_url += f"maxPrice={max_price}&"
    if min_price:
        filter_url += f"minPrice={min_price}&"
    actions.append({"label": "Xem thêm", "type": "navigate", "payload": filter_url.rstrip("&?")})
    return {"text": text, "actions": actions}


async def handle_new_arrivals() -> dict:
    """Sản phẩm mới ra mắt — sort=newest (createdAt desc) trên điện thoại."""
    data = await get_products_filtered(product_type="phone", sort="newest", limit=4)
    products = (data.get("products") or data.get("data") or []) if data else []

    if not products:
        return {
            "text": "Hiện chưa có thông tin sản phẩm mới. Bạn xem toàn bộ sản phẩm trên website nhé!",
            "actions": [{"label": "Xem tất cả sản phẩm", "type": "navigate", "payload": "/products"}],
        }

    lines = [f"• {p.get('name', '')} — {_fmt_price(_get_price(p))}" for p in products]
    text = "Sản phẩm mới ra mắt tại PhoneStore:\n" + "\n".join(lines)

    actions = []
    for p in products[:3]:
        slug = p.get("slug", "")
        name = p.get("name", "Xem chi tiết")
        if slug:
            actions.append({"label": name[:25], "type": "navigate", "payload": f"/products/{slug}"})
    actions.append({"label": "Xem tất cả sản phẩm", "type": "navigate", "payload": "/products?sort=newest"})
    return {"text": text, "actions": actions}


# ── Recommend product ─────────────────────────────────────────────────────────

_BUDGET_WORDS = {"trieu", "tr", "k", "trăm", "nghin", "tam", "tầm"}


async def handle_recommend_product(query: str | None) -> dict:
    if query and len(query.strip()) > 2:
        q_lower = query.lower()
        has_brand = any(b in q_lower for b in _BRANDS)
        is_budget = any(w in q_lower.split() for w in _BUDGET_WORDS)
        has_model_num = any(c.isdigit() for c in query) and not is_budget
        if has_brand or has_model_num:
            return await handle_search_product(query)

    # get_featured_products() xếp hạng theo "sold" trên toàn catalog — phụ kiện bán
    # chạy (ốp lưng, sạc...) sẽ lẫn vào câu trả lời tư vấn mua điện thoại nếu không
    # lọc product_type (đã verify bug này qua test thật ở handle_llm tương ứng).
    data = await get_products_filtered(product_type="phone", sort="popular", limit=4)
    products = []
    if data:
        products = data.get("products") or data.get("data") or []

    if not products:
        return {
            "text": (
                "PhoneStore hiện có nhiều dòng điện thoại hot:\n"
                "• iPhone 15 — cao cấp, camera xuất sắc (từ 22 triệu)\n"
                "• Samsung Galaxy A55 — màn hình đẹp, pin trâu (từ 9 triệu)\n"
                "• Xiaomi Redmi Note 13 — hiệu năng tốt, giá rẻ (từ 5 triệu)\n"
                "• Oppo Reno 11 — thiết kế mỏng, chụp ảnh tốt (từ 10 triệu)\n\n"
                "Cho tôi biết ngân sách cụ thể để tư vấn chính xác hơn nhé!"
            ),
            "actions": [
                {"label": "Xem iPhone", "type": "navigate", "payload": "/brand/apple"},
                {"label": "Xem Samsung", "type": "navigate", "payload": "/brand/samsung"},
                {"label": "Xem Xiaomi", "type": "navigate", "payload": "/brand/xiaomi"},
                {"label": "Tất cả điện thoại", "type": "navigate", "payload": "/products"},
            ],
        }

    lines = [f"• {p.get('name', '')} — từ {_fmt_price(_get_price(p))}"
             for p in products[:4]]
    text = "Các sản phẩm bán chạy tại PhoneStore:\n" + "\n".join(lines)
    actions = []
    for p in products[:3]:
        slug = p.get("slug", "")
        name = p.get("name", "Xem chi tiết")
        if slug:
            actions.append({"label": name[:25], "type": "navigate", "payload": f"/products/{slug}"})
    actions.append({"label": "Xem tất cả sản phẩm", "type": "navigate", "payload": "/products"})
    return {"text": text, "actions": actions}


# ── Wallet ────────────────────────────────────────────────────────────────────

async def handle_check_wallet(token: str | None) -> dict:
    if not token:
        return {
            "text": "Bạn cần đăng nhập để xem số dư ví ạ.",
            "actions": [{"label": "Đăng nhập", "type": "navigate", "payload": "/login"}],
        }

    data = await get_wallet(token)
    if not data or not data.get("success"):
        return {
            "text": "Không thể tải thông tin ví lúc này. Vui lòng thử lại sau.",
            "actions": [{"label": "Xem trang ví", "type": "navigate", "payload": "/profile"}],
        }

    balance = data.get("data", {}).get("balance", 0)
    return {
        "text": f"Số dư ví điện tử của bạn: {_fmt_price(balance)}\nBạn có thể dùng số dư này để thanh toán đơn hàng hoặc nạp thêm.",
        "actions": [
            {"label": "Lịch sử giao dịch", "type": "navigate", "payload": "/profile"},
            {"label": "Nạp thêm tiền", "type": "navigate", "payload": "/profile"},
        ],
    }


# ── Coupon ────────────────────────────────────────────────────────────────────

async def handle_validate_coupon(coupon_code: str | None, token: str | None) -> dict:
    if not coupon_code:
        # Không trích được mã cụ thể — người dùng đang hỏi CÓ mã gì, không phải kiểm tra
        # 1 mã đã biết, nên liệt kê coupon thật từ GET /api/coupons thay vì hỏi lại.
        data = await get_active_coupons(token)
        coupons = (data.get("data") or []) if data else []
        if not coupons:
            return {
                "text": "Hiện PhoneStore chưa có mã giảm giá nào đang áp dụng. Bạn theo dõi thêm thông báo từ shop nhé!",
                "actions": [],
            }
        lines = []
        for c in coupons[:6]:
            value_str = f"{c['value']}%" if c.get("type") == "percent" else _fmt_price(c.get("value", 0))
            min_order = c.get("minOrderValue") or 0
            min_str = f" cho đơn từ {_fmt_price(min_order)}" if min_order else ""
            lines.append(f"- {c.get('code', '')}: Giảm {value_str}{min_str}")
        return {
            "text": "Mã giảm giá đang áp dụng:\n" + "\n".join(lines) + "\nBạn áp dụng ở ô mã giảm giá khi thanh toán nhé!",
            "actions": [],
        }

    if not token:
        return {
            "text": f"Bạn cần đăng nhập để kiểm tra mã '{coupon_code}' ạ.",
            "actions": [{"label": "Đăng nhập", "type": "navigate", "payload": "/login"}],
        }

    data = await validate_coupon(coupon_code, 1_000_000, token)
    if not data:
        return {"text": "Không thể kiểm tra mã lúc này. Vui lòng thử lại sau.", "actions": []}

    if data.get("success"):
        discount = _fmt_price(data.get("discountAmount", 0))
        return {
            "text": f"Mã '{coupon_code}' hợp lệ! Bạn được giảm {discount} cho đơn hàng.",
            "actions": [{"label": "Mua ngay", "type": "navigate", "payload": "/products"}],
        }
    else:
        msg = data.get("message", "Mã không hợp lệ hoặc đã hết hạn")
        return {
            "text": f"Mã '{coupon_code}' không dùng được: {msg}",
            "actions": [{"label": "Xem sản phẩm", "type": "navigate", "payload": "/products"}],
        }


# ── Flash sale ────────────────────────────────────────────────────────────────

async def handle_flash_sale() -> dict:
    data = await get_flash_sales()
    sales = []
    if data and data.get("success"):
        sales = data.get("data") or data.get("flashSales") or []

    active = [s for s in sales if s.get("isActive")]

    if not active:
        return {
            "text": (
                "Hiện tại chưa có flash sale nào đang diễn ra.\n"
                "Bạn hãy theo dõi thường xuyên để không bỏ lỡ ưu đãi nhé!"
            ),
            "actions": [
                {"label": "Xem sản phẩm", "type": "navigate", "payload": "/products"},
                {"label": "Trang chủ", "type": "navigate", "payload": "/"},
            ],
        }

    lines = []
    for s in active[:3]:
        name = s.get("name") or s.get("title") or "Flash Sale"
        discount = s.get("discountPercent") or s.get("discountValue") or ""
        discount_text = f" — Giảm {discount}%" if discount else ""
        lines.append(f"• {name}{discount_text}")

    text = f"Hiện có {len(active)} chương trình flash sale:\n" + "\n".join(lines)
    return {
        "text": text,
        "actions": [{"label": "Xem flash sale", "type": "navigate", "payload": "/"}],
    }


# ── FAQ: Shipping ─────────────────────────────────────────────────────────────

def handle_faq_shipping() -> dict:
    return {
        "text": (
            "Thông tin giao hàng tại PhoneStore:\n"
            "• Giao hàng toàn quốc 63 tỉnh thành\n"
            "• Nội thành Hà Nội & TP.HCM: 1-2 ngày\n"
            "• Tỉnh thành khác: 3-5 ngày làm việc\n"
            "• Phí ship: 30.000₫ (miễn phí cho đơn từ 500.000₫)\n"
            "• Giao nhanh trong ngày: 50.000₫ (Hà Nội & TP.HCM)"
        ),
        "actions": [
            {"label": "Xem chính sách", "type": "navigate", "payload": "/policy"},
        ],
    }


# ── FAQ: Warranty ─────────────────────────────────────────────────────────────

def handle_faq_warranty() -> dict:
    return {
        "text": (
            "Chính sách bảo hành PhoneStore:\n"
            "• Điện thoại chính hãng: 12 tháng bảo hành\n"
            "• Đổi mới trong 7 ngày nếu lỗi nhà sản xuất\n"
            "• Bảo hành tại tất cả cửa hàng PhoneStore toàn quốc\n"
            "• Hotline hỗ trợ: 1800 6789 (miễn phí, 8h–22h)"
        ),
        "actions": [{"label": "Xem chính sách đầy đủ", "type": "navigate", "payload": "/policy"}],
    }


# ── FAQ: Payment ──────────────────────────────────────────────────────────────

def handle_faq_payment() -> dict:
    return {
        "text": (
            "Hình thức thanh toán tại PhoneStore:\n"
            "• COD — thanh toán khi nhận hàng\n"
            "• Chuyển khoản ngân hàng (VietQR)\n"
            "• VNPay (ATM, Visa, MasterCard, QR)\n"
            "• Ví PhoneStore (nạp tiền nhận ưu đãi)\n"
            "• Trả góp 0% từ 6-24 tháng qua thẻ tín dụng"
        ),
        "actions": [],
    }


# ── Contact info ──────────────────────────────────────────────────────────────

def handle_contact_info() -> dict:
    return {
        "text": (
            "Thông tin liên hệ PhoneStore:\n"
            "• Hotline: 1800 6789 (miễn phí, 8h–22h hàng ngày)\n"
            "• Email: support@phonestore.vn\n"
            "• Hệ thống cửa hàng toàn quốc\n"
            "• Chat trực tiếp với nhân viên khi có admin online"
        ),
        "actions": [
            {"label": "Về chúng tôi", "type": "navigate", "payload": "/about"},
            {"label": "FAQ", "type": "navigate", "payload": "/faq"},
        ],
    }


# ── Return product ────────────────────────────────────────────────────────────

def handle_return_product() -> dict:
    return {
        "text": (
            "Chính sách đổi trả tại PhoneStore:\n"
            "• Đổi mới trong 7 ngày nếu lỗi nhà sản xuất\n"
            "• Sản phẩm phải còn nguyên hộp, phụ kiện đầy đủ\n"
            "• Hoàn tiền về ví PhoneStore trong 24h sau khi duyệt\n"
            "• Liên hệ hotline 1800 6789 để được hỗ trợ\n\n"
            "Bạn có thể tạo yêu cầu đổi trả trong trang đơn hàng."
        ),
        "actions": [
            {"label": "Xem đơn hàng", "type": "navigate", "payload": "/orders"},
            {"label": "Chính sách đầy đủ", "type": "navigate", "payload": "/policy"},
        ],
    }


# ── Goodbye ──────────────────────────────────────────────────────────────────

def handle_goodbye() -> dict:
    return {
        "text": (
            "Cảm ơn bạn đã liên hệ PhoneStore!\n"
            "Chúc bạn mua sắm vui vẻ. Nếu cần hỗ trợ thêm, đừng ngại nhắn lại nhé!"
        ),
        "actions": [
            {"label": "Xem sản phẩm", "type": "navigate", "payload": "/products"},
        ],
    }


# ── Fallback ──────────────────────────────────────────────────────────────────

def handle_fallback() -> dict:
    return {
        "text": (
            "Xin lỗi, tôi chưa hiểu câu hỏi của bạn.\n"
            "Bạn có thể thử hỏi về:\n"
            "• Đơn hàng, giao hàng, bảo hành\n"
            "• Tìm sản phẩm, so sánh giá\n"
            "• Khuyến mãi, mã giảm giá\n"
            "Hoặc gọi hotline 1800 6789 để được hỗ trợ trực tiếp."
        ),
        "actions": [
            {"label": "Tìm sản phẩm", "type": "trigger_intent", "payload": "tư vấn điện thoại"},
            {"label": "Xem đơn hàng", "type": "trigger_intent", "payload": "kiểm tra đơn hàng"},
            {"label": "Liên hệ", "type": "trigger_intent", "payload": "hotline liên hệ"},
        ],
    }
