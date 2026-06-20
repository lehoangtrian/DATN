from dotenv import load_dotenv
load_dotenv()

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from intent import (
    detect_intent, _extract_search_query, _extract_price_range, _extract_brand,
    _extract_category, filter_exact_match, _extract_compare_targets,
    _is_generic_accessory_query, _is_generic_charger_query, GENERIC_CHARGER_CATEGORIES,
)
from templates import (
    handle_greeting,
    handle_check_order,
    handle_search_product,
    handle_product_detail,
    handle_price_range,
    handle_new_arrivals,
    handle_recommend_product,
    handle_check_wallet,
    handle_check_points,
    handle_validate_coupon,
    handle_flash_sale,
    handle_faq_shipping,
    handle_faq_warranty,
    handle_faq_payment,
    handle_contact_info,
    handle_return_product,
    handle_cancel_order,
    handle_goodbye,
    handle_fallback,
)
import llm as llm_client
from actions import search_products, get_orders, get_wallet, get_flash_sales, get_product_detail

BOT_MODE = os.getenv("BOT_MODE", "keyword").lower()

app = FastAPI(title="PhoneStore Chat Bot", version="3.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://localhost:5173"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    text: str
    user_token: str | None = None
    session_id: str | None = None


class ChatResponse(BaseModel):
    text: str
    actions: list[dict]
    intent: str
    confidence: float


# ── Keyword mode handlers ──────────────────────────────────────────────────

INTENT_HANDLERS = {
    "greeting":       lambda req, _: handle_greeting(),
    "contact_info":   lambda req, _: handle_contact_info(),
    "faq_shipping":   lambda req, _: handle_faq_shipping(),
    "faq_warranty":   lambda req, _: handle_faq_warranty(),
    "faq_payment":    lambda req, _: handle_faq_payment(),
    "return_product": lambda req, _: handle_return_product(),
    "cancel_order":   lambda req, _: handle_cancel_order(),
    "goodbye":        lambda req, _: handle_goodbye(),
}

ASYNC_INTENT_HANDLERS = {
    "check_order":    lambda req, ex: handle_check_order(req.user_token),
    "check_wallet":   lambda req, ex: handle_check_wallet(req.user_token),
    "check_points":   lambda req, ex: handle_check_points(req.user_token),
    "flash_sale":     lambda req, ex: handle_flash_sale(),
    "validate_coupon":lambda req, ex: handle_validate_coupon(ex.get("coupon_code"), req.user_token),
    "search_product": lambda req, ex: handle_search_product(ex.get("query") or req.text),
    "product_detail": lambda req, ex: handle_product_detail(ex.get("query") or req.text),
    "recommend_product": lambda req, ex: handle_recommend_product(ex.get("query")),
    "price_range":    lambda req, ex: handle_price_range(
        ex.get("min_price"), ex.get("max_price"), ex.get("brand")
    ),
    "new_arrivals":   lambda req, ex: handle_new_arrivals(),
}


async def handle_keyword(req: ChatRequest) -> ChatResponse:
    """Chế độ keyword matching — luôn hoạt động, không cần GPU."""
    intent, confidence, extras = detect_intent(req.text)

    if intent in INTENT_HANDLERS:
        result = INTENT_HANDLERS[intent](req, extras)
    elif intent in ASYNC_INTENT_HANDLERS:
        result = await ASYNC_INTENT_HANDLERS[intent](req, extras)
    else:
        result = handle_fallback()

    return ChatResponse(
        text=result["text"],
        actions=result.get("actions", []),
        intent=intent,
        confidence=confidence,
    )


# ── LLM mode (Ollama fine-tuned model) ────────────────────────────────────

_session_history: dict[str, list[dict]] = {}
MAX_HISTORY = 20


def _needs_live_data(text: str) -> str | None:
    """Phát hiện câu hỏi cần tra cứu dữ liệu thực từ API."""
    t = text.lower()
    if any(w in t for w in ["đơn hàng", "đơn của", "order", "đặt hàng rồi", "đơn đâu"]):
        return "orders"
    if any(w in t for w in [
        "điểm thưởng", "điểm tích lũy", "tích điểm", "tích lũy điểm",
        "đổi điểm", "bao nhiêu điểm", "hạng thành viên", "hạng hiện tại",
    ]):
        return "points"
    if any(w in t for w in ["số dư", "ví", "balance", "tiền trong ví"]):
        return "wallet"
    # Coupon (mã giảm giá) phải kiểm tra TRƯỚC flash_sales — "mã giảm giá" chứa substring
    # "giảm giá" nên nếu flash_sales check trước và có từ khóa "giảm giá" thì câu hỏi mã
    # giảm giá sẽ bị flash_sales "chặn" mất, không bao giờ tới được nhánh coupons.
    if any(w in t for w in [
        "mã giảm giá", "mã khuyến mãi", "mã ưu đãi", "mã code", "coupon", "voucher",
    ]):
        return "coupons"
    if any(w in t for w in [
        "flash sale", "đang sale", "khuyến mãi gì", "deal hôm nay",
        "đang giảm giá", "giảm giá", "sản phẩm giảm giá", "hàng giảm giá",
        "đang khuyến mãi",
    ]):
        return "flash_sales"
    if any(w in t for w in [
        "mới ra mắt", "vừa ra mắt", "mới về", "hàng mới", "mới nhất", "sản phẩm mới", "máy mới",
    ]):
        return "new_arrivals"
    if any(w in t for w in [
        "best seller", "bestseller", "bán chạy", "bán nhiều nhất", "nổi bật", "phổ biến",
    ]):
        return "bestsellers"
    # Đánh giá cao / rating — phải tách riêng khỏi "search" vì cần sort=rating thay vì
    # sort=popular; nếu không có nhánh riêng, câu hỏi rơi vào search với query bị trích
    # xuất sai (vd "san pham danh gia cao") luôn ra 0 kết quả — đã verify bug này qua
    # test thật (hỏi "sản phẩm đánh giá cao", bot hỏi lại chung chung không có dữ liệu).
    if any(w in t for w in [
        "đánh giá cao", "đánh giá tốt nhất", "review cao", "rating cao",
        "lượt đánh giá cao", "được đánh giá cao", "đánh giá tốt",
    ]):
        return "top_rated"
    # Price range query — fetch filtered products
    if any(w in t for w in ["tầm", "dưới", "khoảng", "triệu", "ngân sách", "giá rẻ"]):
        return "price_range"
    if any(w in t for w in [
        "iphone", "samsung", "xiaomi", "oppo", "vivo", "realme",
        "pixel", "oneplus", "nokia", "motorola",
        "tìm", "có bán", "giá bao nhiêu", "bao nhiêu tiền",
        "còn hàng", "cho xem", "muốn mua", "chi tiết", "thông số",
        "màu sắc", "màu nào", "còn màu",
        "tai nghe", "ốp lưng", "bao da", "sạc nhanh", "sạc không dây",
        "sạc dự phòng", "cáp sạc", "dây sạc", "phụ kiện", "sạc",
        "so sánh", "so sanh", "compare",
    ]):
        return "search"
    return None


def _is_compare_request(text: str) -> bool:
    """Phát hiện câu hỏi muốn so sánh nhiều sản phẩm — dùng để gắn thêm action
    trỏ tới trang /compare?ids=... khi có ≥2 sản phẩm khớp, thay vì chỉ liệt kê giá."""
    t = text.lower()
    return any(w in t for w in ["so sánh", "so sanh", "compare"])


def _format_products_detailed(data: dict | None, detail: dict | None = None) -> str:
    """Format sản phẩm với variants/tồn kho nếu có."""
    if not data:
        return ""
    products = data.get("products") or data.get("data") or []
    if not products:
        return ""

    lines = ["Sản phẩm tìm được:"]
    for i, p in enumerate(products[:4]):
        name = p.get("name", "")
        cv   = p.get("cheapestVariant") or {}
        price = (p.get("minPrice") or p.get("price") or
                 cv.get("salePrice") or cv.get("price") or 0)
        price_str = f"{int(price):,}".replace(",", ".") + "₫" if price else "Liên hệ"
        slug = p.get("slug", "")
        rating = p.get("rating", 0)
        rating_str = f" ⭐{rating:.1f}" if rating else ""
        lines.append(f"- {name}: {price_str}{rating_str} | /products/{slug}")

        # Nếu có detail cho sản phẩm đầu tiên, thêm variants
        if i == 0 and detail:
            detail_data = detail.get("data") or detail.get("product") or {}
            variants = detail_data.get("variants") or []
            if variants:
                lines.append("  Phiên bản:")
                for v in variants[:4]:
                    color = v.get("color", "")
                    storage = v.get("storage", "")
                    label = " / ".join(filter(None, [color, storage]))
                    v_price = v.get("salePrice") or v.get("price") or 0
                    stock = v.get("stock", 0)
                    v_price_str = f"{int(v_price):,}".replace(",", ".") + "₫"
                    status = "còn hàng" if stock > 0 else "hết hàng"
                    lines.append(f"    + {label}: {v_price_str} ({status})")
    return "\n".join(lines)


def _format_orders(data: dict | None) -> str:
    if not data:
        return ""
    orders = data.get("orders") or data.get("data") or []
    if not orders:
        return "Bạn chưa có đơn hàng nào."
    lines = ["Đơn hàng gần đây:"]
    for o in orders[:5]:
        code      = o.get("orderCode", o.get("_id", ""))[:12]
        status    = o.get("status", "")
        total     = o.get("totalPrice", 0)
        total_str = f"{int(total):,}".replace(",", ".") + "₫"
        lines.append(f"- #{code}: {status} — {total_str}")
    return "\n".join(lines)


def _format_coupons(data: dict | None) -> str:
    if not data:
        return ""
    coupons = data.get("data") or []
    if not coupons:
        return "Hiện không có mã giảm giá nào đang áp dụng."
    lines = ["Mã giảm giá đang áp dụng:"]
    for c in coupons[:6]:
        code = c.get("code", "")
        value_str = f"{c['value']}%" if c.get("type") == "percent" else f"{int(c.get('value', 0)):,}".replace(",", ".") + "₫"
        min_order = c.get("minOrderValue") or 0
        min_str = f" cho đơn từ {int(min_order):,}".replace(",", ".") + "₫" if min_order else ""
        lines.append(f"- {code}: Giảm {value_str}{min_str}")
    return "\n".join(lines)


def _format_flash_sales(data: dict | None) -> str:
    if not data:
        return ""
    sales  = data.get("flashSales") or data.get("data") or []
    active = [s for s in sales if s.get("isActive")]
    if not active:
        return "Hiện không có flash sale nào đang chạy."
    lines = ["Flash sale đang diễn ra:"]
    for s in active[:3]:
        name = s.get("name", "Flash Sale")
        discount = s.get("discountPercent") or s.get("discountValue") or ""
        discount_str = f" — Giảm {discount}%" if discount else ""
        lines.append(f"- {name}{discount_str}")
    return "\n".join(lines)


async def handle_llm(req: ChatRequest) -> ChatResponse:
    """Chế độ LLM — dùng Ollama với model đã fine-tune."""
    sid     = req.session_id or "default"
    history = _session_history.setdefault(sid, [])

    history.append({"role": "user", "content": req.text})

    tools_context = ""
    need = _needs_live_data(req.text)
    actions: list[dict] = []

    # Yêu cầu so sánh nhưng KHÔNG nêu rõ 2 tên sản phẩm cụ thể (vd "tôi muốn so sánh sản
    # phẩm") — trả lời trực tiếp, KHÔNG gọi LLM. Model fine-tune chỉ được huấn luyện để ưu
    # tiên "Thông tin tra cứu thực tế" cho dữ liệu giá/tồn kho cụ thể, không tuân theo tốt
    # một chỉ dẫn hành vi (meta-instruction) chèn vào cùng vị trí đó — đã verify qua test
    # thật: chèn hướng dẫn "hãy hỏi khách muốn so sánh sản phẩm nào" vào tools_context,
    # model vẫn trả lời lạc đề (hỏi về đơn hàng/giao hàng/bảo hành không liên quan).
    if _is_compare_request(req.text) and not _extract_compare_targets(req.text):
        reply_text = (
            "Bạn muốn so sánh những sản phẩm nào vậy? Ví dụ: \"so sánh iPhone 15 với "
            "Samsung Galaxy A55\" — mình sẽ lấy giá và thông số thật để so sánh giúp bạn nhé!"
        )
        history.append({"role": "assistant", "content": reply_text})
        _session_history[sid] = history[-MAX_HISTORY:]
        return ChatResponse(text=reply_text, actions=[], intent="compare_clarify", confidence=1.0)

    if need == "orders" and req.user_token:
        tools_context = _format_orders(await get_orders(req.user_token))
        actions.append({"label": "Xem đơn hàng", "type": "navigate", "payload": "/orders"})

    elif need == "wallet" and req.user_token:
        data = await get_wallet(req.user_token)
        if data:
            balance = data.get("data", {}).get("balance", 0)
            tools_context = f"Số dư ví: {int(balance):,}".replace(",", ".") + "₫"
        actions.append({"label": "Xem ví", "type": "navigate", "payload": "/profile?tab=wallet"})

    elif need == "points" and req.user_token:
        from actions import get_profile
        data = await get_profile(req.user_token)
        if data and data.get("success"):
            profile = data.get("data", {})
            points = int(profile.get("loyaltyPoints", 0) or 0)
            tier = profile.get("memberTier", "bronze")
            tools_context = f"Điểm thưởng hiện tại: {points} điểm. Hạng thành viên: {tier}."
        actions.append({"label": "Xem điểm thưởng", "type": "navigate", "payload": "/profile"})

    elif need == "flash_sales":
        tools_context = _format_flash_sales(await get_flash_sales())

    elif need == "coupons":
        from actions import get_active_coupons
        tools_context = _format_coupons(await get_active_coupons(req.user_token))
        actions.append({"label": "Xem mã giảm giá", "type": "navigate", "payload": "/profile"})

    elif need == "new_arrivals":
        from actions import get_products_filtered
        newest = await get_products_filtered(product_type="phone", sort="newest", limit=4)
        tools_context = _format_products_detailed(newest)
        actions.append({"label": "Xem tất cả sản phẩm", "type": "navigate", "payload": "/products?sort=newest"})

    elif need == "bestsellers":
        from actions import get_products_filtered
        popular = await get_products_filtered(product_type="phone", sort="popular", limit=4)
        tools_context = _format_products_detailed(popular)
        actions.append({"label": "Xem tất cả sản phẩm", "type": "navigate", "payload": "/products?sort=popular"})

    elif need == "top_rated":
        from actions import get_products_filtered
        top_rated = await get_products_filtered(product_type="phone", sort="rating", limit=4)
        tools_context = _format_products_detailed(top_rated)
        actions.append({"label": "Xem tất cả sản phẩm", "type": "navigate", "payload": "/products?sort=rating"})

    elif need == "price_range":
        min_p, max_p = _extract_price_range(req.text)
        brand = _extract_brand(req.text)
        from actions import get_products_filtered
        # sort="price_desc" — liệt kê từ giá cao xuống thấp trong khoảng đã hỏi, theo yêu
        # cầu hiển thị (mặc định get_products_filtered() là price_asc nếu không truyền sort).
        filtered = await get_products_filtered(
            brand=brand, product_type="phone", min_price=min_p, max_price=max_p,
            sort="price_desc", limit=5,
        )
        tools_context = _format_products_detailed(filtered)
        actions.append({"label": "Xem tất cả sản phẩm", "type": "navigate", "payload": "/products?sort=price_desc"})

    elif need == "search":
        category = _extract_category(req.text)
        matched_products: list[dict] = []
        is_compare = _is_compare_request(req.text)
        # Trường hợp is_compare=True nhưng không trích được 2 tên cụ thể đã được short-circuit
        # trả lời sớm ở đầu handle_llm (không qua LLM) — tới đây compare_targets chỉ còn None
        # khi is_compare=False (câu hỏi search thường, không liên quan so sánh).
        compare_targets = _extract_compare_targets(req.text) if is_compare else None
        if compare_targets:
            # "so sánh A với B" — search RIÊNG từng tên sản phẩm, không ghép chung 1 query.
            # search_products() match substring tên trên server, ghép cả 2 tên vào 1 câu sẽ
            # luôn ra 0 kết quả (không sản phẩm nào có tên chứa cả 2 cụm) — đã verify bug
            # này qua test thật: hỏi so sánh 2 máy cụ thể, bot trả lời chung chung không có
            # số liệu thật vì không tìm được sản phẩm nào.
            for target_query in compare_targets:
                found_data = await search_products(target_query, limit=3)
                found = (found_data.get("products") or found_data.get("data") or []) if found_data else []
                found = filter_exact_match(found, target_query)
                if found:
                    matched_products.append(found[0])
            tools_context = _format_products_detailed({"data": matched_products})
        elif category:
            # Hỏi theo danh mục phụ kiện (vd "tai nghe", "ốp lưng") — tên sản phẩm thường
            # là tên thương hiệu tiếng Anh nên search theo tên sẽ không khớp, phải filter
            # theo category slug thật trên server thay vì tìm theo tên.
            from actions import get_products_filtered
            search_data = await get_products_filtered(category=category, limit=4)
            tools_context = _format_products_detailed(search_data)
            matched_products = (search_data.get("products") or search_data.get("data") or []) if search_data else []
        elif _is_generic_charger_query(req.text):
            # "sạc điện thoại" (không rõ nhanh/không dây) — browse RIÊNG nhóm category liên
            # quan tới sạc (sạc nhanh + sạc không dây + cáp sạc) thay vì toàn bộ phụ kiện,
            # tránh lẫn ốp lưng/tai nghe không liên quan vào kết quả (đã verify qua test
            # thật: browse accessory chung trả về cả ốp lưng, tai nghe khi hỏi "sạc").
            from actions import get_products_filtered
            search_data = await get_products_filtered(categories=GENERIC_CHARGER_CATEGORIES, sort="popular", limit=4)
            tools_context = _format_products_detailed(search_data)
            matched_products = (search_data.get("products") or search_data.get("data") or []) if search_data else []
        elif _is_generic_accessory_query(req.text):
            # "phụ kiện điện thoại" — nhắc tới phụ kiện chung nhưng không khớp category cụ
            # thể nào (tai nghe/sạc nhanh/sạc không dây/ốp lưng...). Không có sản phẩm nào
            # tên là "phụ kiện" nên search theo tên sẽ luôn ra 0 kết quả → tools_context
            # trống → model bịa lạc đề (đã verify bug này qua test thật: hỏi "phụ kiện điện
            # thoại", bot trả lời nhầm sang chính sách giao hàng). Browse toàn bộ phụ kiện
            # bán chạy (productType=accessory) thay vì tìm theo tên.
            from actions import get_products_filtered
            search_data = await get_products_filtered(product_type="accessory", sort="popular", limit=4)
            tools_context = _format_products_detailed(search_data)
            matched_products = (search_data.get("products") or search_data.get("data") or []) if search_data else []
        else:
            query = _extract_search_query(req.text)
            if query:
                search_data = await search_products(query, limit=4)
                # Lấy detail sản phẩm đầu tiên để có variant/tồn kho
                detail = None
                matched_products = (search_data.get("products") or search_data.get("data") or []) if search_data else []
                matched_products = filter_exact_match(matched_products, query)
                search_data = {"data": matched_products}
                if matched_products and matched_products[0].get("slug"):
                    detail = await get_product_detail(matched_products[0]["slug"])
                tools_context = _format_products_detailed(search_data, detail)
            else:
                # Không trích được query cụ thể (vd "tôi muốn mua điện thoại" — "điện thoại"
                # là stopword quá chung) — dùng sản phẩm bán chạy nhưng PHẢI lọc product_type
                # "phone": get_featured_products() xếp hạng theo "sold" trên toàn catalog,
                # nên phụ kiện bán chạy (ốp lưng, sạc...) sẽ lẫn vào — đã verify bug này qua
                # test thật (hỏi mua điện thoại, bot trả về kèm ốp lưng).
                from actions import get_products_filtered
                featured = await get_products_filtered(product_type="phone", sort="popular", limit=4)
                tools_context = _format_products_detailed(featured)
        actions.append({"label": "Xem tất cả sản phẩm", "type": "navigate", "payload": "/products"})

        # Câu hỏi "so sánh" + có ≥2 sản phẩm khớp → thêm action trỏ thẳng tới trang
        # So sánh (đã có sẵn /compare?ids=...) thay vì chỉ liệt kê giá suông.
        if _is_compare_request(req.text) and len(matched_products) >= 2:
            # Tối đa 3 — khớp giới hạn của CompareContext phía client (toggle() chặn ở 3)
            ids = [p["_id"] for p in matched_products[:3] if p.get("_id")]
            if len(ids) >= 2:
                actions.append({
                    "label": "So sánh các sản phẩm này",
                    "type": "navigate",
                    "payload": f"/compare?ids={','.join(ids)}",
                })

    # Khi đã có tools_context (dữ liệu tra cứu thật cho CÂU HỎI HIỆN TẠI: giá/sản phẩm theo
    # tầm giá, bán chạy, đánh giá cao...), CHỈ gửi câu hỏi hiện tại cho model, KHÔNG gửi cả
    # lịch sử hội thoại trước đó. Lý do: nếu gửi full history, model thấy cả câu trả lời CỦA
    # CHÍNH NÓ ở lượt trước (cũng là dữ liệu thật, vd đã liệt kê "iPhone 14, ...") và dễ lẫn
    # sản phẩm đó vào câu trả lời mới dù không khớp điều kiện mới (vd hỏi "dưới 3 triệu" sau
    # khi vừa hỏi "bán chạy" — model trả lời kèm cả iPhone 14 14.490.000đ, sai hoàn toàn điều
    # kiện giá) — đã verify bug này qua test thật (2 lượt hỏi liên tiếp trong cùng session).
    # Khi tools_context trống (chat thường/chào hỏi), vẫn gửi full history để giữ mạch hội thoại.
    llm_messages = [history[-1]] if tools_context else history
    reply_text = await llm_client.chat(messages=llm_messages, tools_context=tools_context)

    history.append({"role": "assistant", "content": reply_text})
    _session_history[sid] = history[-MAX_HISTORY:]

    return ChatResponse(text=reply_text, actions=actions, intent="llm", confidence=1.0)


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    ollama_ok = await llm_client.is_available() if BOT_MODE == "llm" else None
    return {
        "status": "ok",
        "service": "PhoneStore ChatBot",
        "version": "3.1.0",
        "mode": BOT_MODE,
        "ollama_available": ollama_ok,
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not req.text or not req.text.strip():
        return ChatResponse(
            text="Bạn cần nhập nội dung tin nhắn.",
            actions=[],
            intent="empty",
            confidence=0,
        )

    if BOT_MODE == "llm" and await llm_client.is_available():
        return await handle_llm(req)

    return await handle_keyword(req)


if __name__ == "__main__":
    print(f"Starting PhoneStore Bot v3.1 [{BOT_MODE.upper()} mode]")
    if BOT_MODE == "llm":
        print(f"  Ollama: {llm_client.OLLAMA_URL}  Model: {llm_client.OLLAMA_MODEL}")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
