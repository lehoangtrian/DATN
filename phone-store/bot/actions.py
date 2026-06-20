import os
import httpx

NODE_API = os.getenv("NODE_API_URL", "http://localhost:5000/api")
_TIMEOUT = httpx.Timeout(5.0)


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def get_orders(token: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(f"{NODE_API}/orders", headers=_auth_headers(token))
            return r.json() if r.status_code == 200 else None
    except Exception:
        return None


async def search_products(query: str, limit: int = 5, product_type: str | None = "phone") -> dict | None:
    """Tìm sản phẩm theo tên. Mặc định product_type="phone" vì mọi nơi gọi hàm này trong
    bot đều tìm điện thoại theo tên/hãng (BRANDS trong intent.py chỉ là hãng điện thoại) —
    nếu không lọc, tên ốp lưng/case có chứa tên máy (vd "Apple Clear Case iPhone 15 Pro")
    sẽ lẫn vào kết quả tìm điện thoại (đã verify bug này qua test thật)."""
    try:
        params: dict = {"q": query, "limit": limit}
        if product_type:
            params["productType"] = product_type
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(f"{NODE_API}/products/search", params=params)
            return r.json() if r.status_code == 200 else None
    except Exception:
        return None


async def get_product_detail(slug: str) -> dict | None:
    """GET /api/products/:slug — trả về sản phẩm đầy đủ cùng variants (màu, dung lượng, tồn kho)."""
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(f"{NODE_API}/products/{slug}")
            return r.json() if r.status_code == 200 else None
    except Exception:
        return None


async def get_products_filtered(
    brand: str | None = None,
    category: str | None = None,
    categories: list[str] | None = None,
    product_type: str | None = None,
    min_price: int | None = None,
    max_price: int | None = None,
    sort: str = "price_asc",
    limit: int = 6,
) -> dict | None:
    """GET /api/products với filter giá, thương hiệu, danh mục (category slug).
    `categories` (nhiều slug, OR với nhau) dùng khi 1 từ khóa chung ứng với nhiều category
    thật (vd "sạc" gồm cả sạc nhanh/sạc không dây/cáp sạc) — server hỗ trợ qua query
    param `categories` riêng (phân biệt với `category` số ít, exact 1 slug)."""
    try:
        params: dict = {"limit": limit, "sort": sort}
        if brand:
            params["brand"] = brand
        if category:
            params["category"] = category
        if categories:
            params["categories"] = ",".join(categories)
        if product_type:
            params["productType"] = product_type
        if min_price is not None:
            params["minPrice"] = min_price
        if max_price is not None:
            params["maxPrice"] = max_price
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(f"{NODE_API}/products", params=params)
            return r.json() if r.status_code == 200 else None
    except Exception:
        return None


async def get_wallet(token: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(
                f"{NODE_API}/wallet/balance",
                headers=_auth_headers(token),
            )
            return r.json() if r.status_code == 200 else None
    except Exception:
        return None


async def get_profile(token: str) -> dict | None:
    """GET /api/profile — không có endpoint riêng cho điểm thưởng, lấy chung từ profile
    (data.loyaltyPoints, data.memberTier)."""
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(f"{NODE_API}/profile", headers=_auth_headers(token))
            return r.json() if r.status_code == 200 else None
    except Exception:
        return None


async def validate_coupon(code: str, cart_total: float, token: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.post(
                f"{NODE_API}/coupons/validate",
                json={"code": code, "cartTotal": cart_total},
                headers=_auth_headers(token),
            )
            return r.json()
    except Exception:
        return None


async def get_flash_sales() -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(f"{NODE_API}/flash-sales")
            return r.json() if r.status_code == 200 else None
    except Exception:
        return None


async def get_active_coupons(token: str | None = None) -> dict | None:
    """GET /api/coupons — danh sách mã giảm giá public đang active (optionalAuth: có
    token thì server còn lọc thêm theo hạng thành viên)."""
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            headers = _auth_headers(token) if token else {}
            r = await client.get(f"{NODE_API}/coupons", headers=headers)
            return r.json() if r.status_code == 200 else None
    except Exception:
        return None
