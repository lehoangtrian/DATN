# Kế hoạch & Tiến độ — PhoneStore Chat Bot

## Tổng quan

Hệ thống hỗ trợ khách hàng kết hợp **live chat với admin** (khi admin online) và **Python AI bot** (khi admin offline). Bot trả lời tự nhiên bằng tiếng Việt và có thể thực hiện tra cứu thực tế thay user.

---

## Kiến trúc tổng thể

```
User Browser (React ChatWidget)
      ↕ Socket.IO  (port 5000)
Node.js Express Server  ← orchestrator duy nhất
      ↕ HTTP POST, 8s timeout
Python FastAPI Bot  (port 8000)
      ↕ httpx async
Node.js REST API  (/api/orders, /api/products, /api/wallet, /api/coupons)
      ↕ MongoDB
```

**Nguyên tắc routing:**
1. `session.assignedTo` có giá trị → forward tới admin đang phụ trách
2. `isAdminOnline()` trả về true → mở session, cảnh báo admin_chat_room
3. Không có admin → gọi Python bot, relay reply về user

---

## Danh sách file đã implement

### Backend — Node.js

| File | Trạng thái | Mô tả |
|------|-----------|-------|
| `server/src/models/ChatSession.js` | ✅ Hoàn thành | Schema session: userId, status (bot/open/closed), assignedTo, unreadByAdmin |
| `server/src/models/ChatMessage.js` | ✅ Hoàn thành | Schema tin nhắn: sender (user/admin/bot), text, actions[], metadata |
| `server/src/models/index.js` | ✅ Cập nhật | Export ChatSession, ChatMessage |
| `server/src/controllers/chat.controller.js` | ✅ Hoàn thành | Logic chat, gọi bot HTTP, REST handlers |
| `server/src/routes/chat.routes.js` | ✅ Hoàn thành | Route `/api/chat/*` với middleware protect/requireRole |
| `server/src/app.js` | ✅ Cập nhật | Đăng ký `/api/chat` route |
| `server/server.js` | ✅ Cập nhật | Admin presence Map, Socket.IO events, `setChatIO()` |

### Python Bot

| File | Trạng thái | Mô tả |
|------|-----------|-------|
| `bot/main.py` | ✅ Hoàn thành | FastAPI app port 8000, POST /chat, GET /health; dict dispatch INTENT_HANDLERS + ASYNC_INTENT_HANDLERS |
| `bot/intent.py` | ✅ Hoàn thành | Keyword scoring, **13 intents**, word-boundary matching, accent-insensitive `_normalize()`, `_NOISE_SUFFIX` query cleanup, punctuation stripping trước matching |
| `bot/actions.py` | ✅ Hoàn thành | httpx async client: orders, products/search, **products/featured**, wallet, coupon, **flash-sales** |
| `bot/templates.py` | ✅ Hoàn thành | **13 response handlers** tiếng Việt, quick-reply actions, `_get_price()` đọc từ cheapestVariant |
| `bot/requirements.txt` | ✅ Hoàn thành | fastapi, uvicorn, httpx, python-dotenv |
| `bot/.env` | ✅ Hoàn thành | NODE_API_URL=http://localhost:5000/api |

### Frontend — React

| File | Trạng thái | Mô tả |
|------|-----------|-------|
| `client/src/utils/socketInstance.js` | ✅ Hoàn thành | Socket singleton, getSocket() / disconnectSocket() |
| `client/src/hooks/useSocket.js` | ✅ Cập nhật | Dùng getSocket() từ socketInstance |
| `client/src/hooks/useChatSocket.js` | ✅ Hoàn thành | State chat: messages, adminOnline, isBotTyping, sendMessage |
| `client/src/api/chat.js` | ✅ Hoàn thành | 7 REST helpers cho chat |
| `client/src/components/chat/ChatWidget.jsx` | ✅ Hoàn thành | Widget nổi góc phải, toggle panel, quick-reply buttons |
| `client/src/pages/admin/AdminChatPage.jsx` | ✅ Hoàn thành | Trang inbox admin tại /admin/chat |
| `client/src/pages/admin/AdminLayout.jsx` | ✅ Cập nhật | Nav item "Chat hỗ trợ" → /admin/chat |
| `client/src/App.jsx` | ✅ Cập nhật | Route /admin/chat, render ChatWidget trong MainLayout |

---

## Socket.IO Events mới

### Client → Server
| Event | Payload | Mô tả |
|-------|---------|-------|
| `chat:send` | `{ text, userToken }` | User gửi tin nhắn |
| `chat:typing` | `{ isTyping }` | Typing indicator |
| `chat:admin_join` | `{ sessionId }` | Admin chọn session |
| `chat:admin_send` | `{ sessionId, text }` | Admin gửi reply |
| `chat:close` | — | User đóng chat |

### Server → Client
| Event | Payload | Tới đâu | Mô tả |
|-------|---------|---------|-------|
| `chat:message` | `{ message }` | user room / admin_chat_room | Tin nhắn mới |
| `chat:typing` | `{ isTyping, sender }` | user room / admin | Typing relay |
| `chat:session_update` | `{ session }` | user + admin | Status đổi |
| `chat:admin_status` | `{ isOnline }` | broadcast | Admin online/offline |
| `chat:new_session` | `{ session }` | admin_chat_room | Session mới |

---

## REST Endpoints mới

| Method | Route | Quyền | Mô tả |
|--------|-------|-------|-------|
| GET | `/api/chat/admin-status` | public | Trạng thái admin online |
| GET | `/api/chat/history` | user | Lịch sử session đang mở |
| POST | `/api/chat/close` | user | Đóng session |
| GET | `/api/chat/sessions` | admin/staff | Danh sách sessions |
| GET | `/api/chat/sessions/:id/messages` | admin/staff | Lịch sử tin nhắn |
| PUT | `/api/chat/sessions/:id/assign` | admin/staff | Nhận session |
| PUT | `/api/chat/sessions/:id/close` | admin/staff | Đóng session |

---

## Intent Bot — 13 intent đã train

| Intent | Threshold | Keywords đại diện | Hành động |
|--------|-----------|-------------------|-----------|
| `greeting` | 0.05 | xin chào, hi, hello, cho hỏi | Static response + quick-reply |
| `check_order` | 0.07 | đơn hàng, order, trạng thái đơn | Gọi GET /api/orders với token user |
| `search_product` | 0.03 | tìm, iphone, samsung, giá, mua | Gọi GET /api/products/search |
| `recommend_product` | 0.05 | tư vấn, nên mua, bán chạy, tầm giá, tầm tiền | Gọi GET /api/products/featured hoặc search theo brand |
| `check_wallet` | 0.08 | ví, số dư, balance | Gọi GET /api/wallet/balance với token |
| `validate_coupon` | 0.08 | mã giảm giá, coupon, voucher, dùng được không | Regex extract code → POST /api/coupons/validate |
| `flash_sale` | 0.07 | flash sale, khuyến mãi, deal, ưu đãi | Gọi GET /api/flash-sales, lọc active |
| `faq_shipping` | 0.07 | giao hàng, ship, vận chuyển | Static: thời gian + phí ship |
| `faq_warranty` | 0.08 | bảo hành, đổi trả, lỗi | Static: 12 tháng, đổi mới 7 ngày |
| `faq_payment` | 0.07 | thanh toán, cod, vnpay, chuyển khoản | Static: 5 hình thức |
| `contact_info` | 0.09 | hotline, liên hệ, địa chỉ, cửa hàng | Static: hotline 1800 6789, email, chat |
| `return_product` | 0.09 | trả hàng, hoàn tiền, đổi máy | Static: 7 ngày đổi trả, hoàn ví 24h |
| `goodbye` | 0.08 | cảm ơn, bye, tạm biệt, ok thôi | Static: lời chào tạm biệt + nút Xem sản phẩm |
| `fallback` | — | (không khớp intent nào) | Gợi ý + hotline |

---

## Bugs đã fix trong quá trình phát triển

| # | Vấn đề | Fix |
|---|--------|-----|
| 1 | `"ship"` match intent `greeting` vì `"hi"` là substring của `"ship"` | Đổi sang word-boundary padding: `f" {kw} "` in `f" {text} "` |
| 2 | Single keyword không pass threshold (score quá thấp) | Hạ threshold: search_product=0.04, faq_shipping=0.07, check_order=0.08 |
| 3 | Unicode ✓/✗ không hiển thị trên Windows console (cp1252) | Dùng `io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')` trong test script |
| 4 | Tiếng Việt có dấu không match khi user gõ không dấu | Thêm `_normalize()`: replace đ/Đ trước, rồi NFKD + strip combining chars |
| 5 | "đ" (U+0111) không decompose trong NFKD → `"đơn"` normalize thành `"đon"` | Replace `'đ'→'d'` TRƯỚC khi gọi `unicodedata.normalize('NFKD', ...)` |
| 6 | `greeting` threshold 0.06: 1/17 keywords = 0.0588 < 0.06 → miss | Hạ threshold greeting 0.06 → 0.05 |
| 7 | `validate_coupon` regex chọn sai code ("KIEM" thay vì "SALE10") | Ưu tiên tìm code SAU trigger-word (mã/code/voucher), fallback ưu tiên code có chữ số |
| 8 | Admin test chat widget bị route sang admin_chat_room (vì tự detect là admin online) | `isAdminOnline(excludeUserId)` — bỏ qua socket của chính người gửi |
| 9 | `"dien thoai nao ban chay nhat"` → fallback (1/26 kw = 0.0385 < threshold 0.04) | Hạ `search_product` threshold 0.04→0.03; hạ `recommend_product` 0.07→0.05 |
| 10 | Query bẩn: "co ban iPhone 15 **khong**?" → search "iphone 15 khong" → API trả [] | `_extract_search_query` dùng stopwords normalized + regex strip noise suffix (`_NOISE_SUFFIX`) |
| 11 | Query bị cắt: "gia iPhone 15 Pro Max bao nhieu?" → "iphone 15 pro max **bao nhie**" | Tăng capture từ `{0,20}` → `{0,35}` rồi strip "bao nhieu" bằng `_NOISE_SUFFIX` |
| 12 | `get_featured_products` gọi `/products?sort=sold_desc` → 400 Bad Request | Đổi sang `/products/featured` (endpoint đúng) |
| 13 | Giá sản phẩm hiển thị "0₫" vì `p.get('price')` trả None | Thêm `_get_price(p)` đọc từ `cheapestVariant.salePrice / price` |
| 14 | `handle_recommend_product` delegate sang search với query vô nghĩa ("nao ban chay nhat") | Chỉ delegate khi query chứa tên brand hoặc số model; ngược lại dùng static fallback |
| 15 | `"ma SUMMER2024 dung duoc khong?"` → fallback vì `?` cuối câu phá word-boundary ("khong?" ≠ "khong ") | Strip punctuation `[?!.,;:]` thành space TRƯỚC khi normalize + match trong `detect_intent()` |
| 16 | `"gia bao nhieu vay?"` → search query nhận `"vay?"` (filler word) | Thêm "vậy", "thế", "nhỉ" vào `_SEARCH_STOPWORDS`; trả `""` khi `len(q) <= 2` |
| 17 | `"co dien thoai tam 10-15 trieu"` → delegate sang search (số "10" trông như model) → API trả [] | Thêm `is_budget` detection trong `handle_recommend_product`: nếu query chứa budget-word thì không delegate sang search |
| 18 | Không có intent khi user nói lời tạm biệt ("ok cam on shop nha") → fallback | Thêm `goodbye` intent với 12 keywords, threshold 0.08; thêm `handle_goodbye()` static response |

---

## Cách chạy

```bash
# 1. Cài Python dependencies (chạy 1 lần)
cd phone-store/bot
pip install -r requirements.txt

# 2. Khởi động Python bot
cd phone-store/bot
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 3. Khởi động Node.js server (terminal khác)
cd phone-store/server
npm run dev

# 4. Khởi động React frontend (terminal khác)
cd phone-store/client
npm run dev
```

---

## Kiểm tra nhanh

```bash
# Kiểm tra bot health
curl http://localhost:8000/health

# Test intent greeting
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"text":"xin chào","user_token":null,"session_id":"test"}'

# Test kiểm tra đơn hàng (cần token thật)
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"text":"đơn hàng của tôi đâu rồi","user_token":"<jwt_token>","session_id":"test"}'
```

---

## Hướng mở rộng (chưa implement)

- [ ] Handoff tự động từ bot sang admin khi bot confidence thấp liên tiếp
- [ ] Analytics: thống kê intent phổ biến, tỷ lệ bot giải quyết thành công
- [ ] Webhook thông báo khi có session mới chưa được phụ trách
- [ ] Streaming response (token-by-token) cho LLM mode

---

## Fine-tuning Local Model (Hướng nâng cao)

### Kiến trúc mới (BOT_MODE=llm)

```
User → ChatWidget → Node.js → Python Bot (FastAPI)
                                    ↓ BOT_MODE=llm
                             Ollama (localhost:11434)
                             Model: phonestore-bot (fine-tuned Qwen2.5-3B)
                                    ↓ nếu cần live data
                             Node.js REST API → MongoDB
```

**So sánh hai chế độ:**

| | BOT_MODE=keyword | BOT_MODE=llm |
|--|--|--|
| Hiểu ngôn ngữ | Keyword matching | LLM hiểu ngữ nghĩa |
| Multi-turn | Không | Có (lưu history/session) |
| Câu trả lời | Template cứng | Tự nhiên, linh hoạt |
| Cần GPU | Không | Chỉ khi fine-tune (Colab) |
| Cần Ollama | Không | Có (chạy local) |
| Fallback | - | Tự động về keyword nếu Ollama down |

### Files Fine-tuning

| File | Mô tả |
|------|-------|
| `bot/data/generate_dataset.py` | Script sinh training data |
| `bot/data/train.jsonl` | 141 hội thoại tiếng Việt (15 chủ đề) |
| `bot/colab_finetune.py` | Script fine-tune trên Google Colab T4 (QLoRA) |
| `bot/Modelfile` | Cấu hình Ollama cho model sau khi export GGUF |
| `bot/llm.py` | Ollama async client, system prompt, fallback |
| `bot/.env` | Thêm BOT_MODE, OLLAMA_URL, OLLAMA_MODEL |

### Training Data — 141 examples

| Chủ đề | Số lượng |
|--------|---------|
| Greeting | 15 |
| Tìm kiếm sản phẩm | 25 |
| Tư vấn / gợi ý | 18 |
| Đơn hàng | 10 |
| Giao hàng / ship | 8 |
| Bảo hành | 8 |
| Thanh toán | 8 |
| Đổi trả | 6 |
| Mã giảm giá | 7 |
| Flash sale | 5 |
| Ví điện tử | 5 |
| Liên hệ | 5 |
| Tạm biệt | 8 |
| Multi-turn | 6 |
| Edge cases | 7 |

### Quy trình Fine-tune

```
1. Mở Google Colab → Runtime: GPU T4 (miễn phí)
2. Upload train.jsonl + colab_finetune.py
3. Chạy từng cell: install → load Qwen2.5-3B → LoRA → train → export GGUF
4. Download phonestore-bot-Q4_K_M.gguf từ Google Drive
5. Cài Ollama: https://ollama.com/download
6. ollama create phonestore-bot -f Modelfile
7. Đổi BOT_MODE=llm trong bot/.env
8. Restart bot: uvicorn main:app ...
```

### LLM Mode — cách hoạt động

```
User: "Samsung A55 giá bao nhiêu?"
        ↓
_needs_live_data() → "search"
        ↓
search_products("samsung a55") → API → danh sách sản phẩm
        ↓
llm.chat(history + tools_context) → Ollama → reply tự nhiên
        ↓
history.append(reply) → multi-turn ready
```
