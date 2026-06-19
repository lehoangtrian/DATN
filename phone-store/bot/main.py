from dotenv import load_dotenv
load_dotenv()

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from intent import detect_intent, _extract_search_query, _extract_price_range, _extract_brand
from templates import (
    handle_greeting,
    handle_check_order,
    handle_search_product,
    handle_product_detail,
    handle_price_range,
    handle_recommend_product,
    handle_check_wallet,
    handle_validate_coupon,
    handle_flash_sale,
    handle_faq_shipping,
    handle_faq_warranty,
    handle_faq_payment,
    handle_contact_info,
    handle_return_product,
    handle_goodbye,
    handle_fallback,
)
import llm as llm_client
from actions import search_products, get_featured_products, get_orders, get_wallet, get_flash_sales, get_product_detail

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
    "goodbye":        lambda req, _: handle_goodbye(),
}

ASYNC_INTENT_HANDLERS = {
    "check_order":    lambda req, ex: handle_check_order(req.user_token),
    "check_wallet":   lambda req, ex: handle_check_wallet(req.user_token),
    "flash_sale":     lambda req, ex: handle_flash_sale(),
    "validate_coupon":lambda req, ex: handle_validate_coupon(ex.get("coupon_code"), req.user_token),
    "search_product": lambda req, ex: handle_search_product(ex.get("query") or req.text),
    "product_detail": lambda req, ex: handle_product_detail(ex.get("query") or req.text),
    "recommend_product": lambda req, ex: handle_recommend_product(ex.get("query")),
    "price_range":    lambda req, ex: handle_price_range(
        ex.get("min_price"), ex.get("max_price"), ex.get("brand")
    ),
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
    if any(w in t for w in ["số dư", "ví", "balance", "tiền trong ví"]):
        return "wallet"
    if any(w in t for w in ["flash sale", "đang sale", "khuyến mãi gì", "deal hôm nay"]):
        return "flash_sales"
    # Price range query — fetch filtered products
    if any(w in t for w in ["tầm", "dưới", "khoảng", "triệu", "ngân sách", "giá rẻ"]):
        return "price_range"
    if any(w in t for w in [
        "iphone", "samsung", "xiaomi", "oppo", "vivo", "realme",
        "pixel", "oneplus", "nokia", "motorola",
        "tìm", "có bán", "giá bao nhiêu", "bao nhiêu tiền",
        "còn hàng", "cho xem", "muốn mua", "chi tiết", "thông số",
        "màu sắc", "màu nào", "còn màu",
    ]):
        return "search"
    return None


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

    if need == "orders" and req.user_token:
        tools_context = _format_orders(await get_orders(req.user_token))
        actions.append({"label": "Xem đơn hàng", "type": "navigate", "payload": "/orders"})

    elif need == "wallet" and req.user_token:
        data = await get_wallet(req.user_token)
        if data:
            balance = data.get("data", {}).get("balance", 0)
            tools_context = f"Số dư ví: {int(balance):,}".replace(",", ".") + "₫"
        actions.append({"label": "Xem ví", "type": "navigate", "payload": "/profile?tab=wallet"})

    elif need == "flash_sales":
        tools_context = _format_flash_sales(await get_flash_sales())

    elif need == "price_range":
        min_p, max_p = _extract_price_range(req.text)
        brand = _extract_brand(req.text)
        from actions import get_products_filtered
        filtered = await get_products_filtered(brand=brand, min_price=min_p, max_price=max_p, limit=5)
        tools_context = _format_products_detailed(filtered)
        actions.append({"label": "Xem tất cả sản phẩm", "type": "navigate", "payload": "/products"})

    elif need == "search":
        query = _extract_search_query(req.text)
        if query:
            search_data = await search_products(query, limit=4)
            # Lấy detail sản phẩm đầu tiên để có variant/tồn kho
            detail = None
            products = (search_data.get("products") or search_data.get("data") or []) if search_data else []
            if products and products[0].get("slug"):
                detail = await get_product_detail(products[0]["slug"])
            tools_context = _format_products_detailed(search_data, detail)
        else:
            tools_context = _format_products_detailed(await get_featured_products())
        actions.append({"label": "Xem tất cả sản phẩm", "type": "navigate", "payload": "/products"})

    reply_text = await llm_client.chat(messages=history, tools_context=tools_context)

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
