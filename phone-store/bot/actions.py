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


async def search_products(query: str, limit: int = 5) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(
                f"{NODE_API}/products/search",
                params={"q": query, "limit": limit},
            )
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
    min_price: int | None = None,
    max_price: int | None = None,
    sort: str = "price_asc",
    limit: int = 6,
) -> dict | None:
    """GET /api/products với filter giá và thương hiệu."""
    try:
        params: dict = {"limit": limit, "sort": sort}
        if brand:
            params["brand"] = brand
        if min_price is not None:
            params["minPrice"] = min_price
        if max_price is not None:
            params["maxPrice"] = max_price
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(f"{NODE_API}/products", params=params)
            return r.json() if r.status_code == 200 else None
    except Exception:
        return None


async def get_featured_products() -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(f"{NODE_API}/products/featured")
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
