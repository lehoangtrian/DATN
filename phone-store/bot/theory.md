# Cơ sở lý thuyết — PhoneStore Chat Bot

## 1. Kiến trúc hệ thống chat

### 1.1 Mô hình Hybrid Chat (Bot + Human)

Hệ thống áp dụng kiến trúc **tiered support** (hỗ trợ theo tầng), phổ biến trong các nền tảng thương mại điện tử:

```
Tầng 1: AI Bot  →  Tầng 2: Human Agent (admin)
```

- **Bot** xử lý các truy vấn lặp đi lặp lại, có cấu trúc rõ ràng (FAQs, tra cứu dữ liệu)
- **Admin** xử lý các yêu cầu phức tạp, cần phán đoán hay thương lượng
- Chuyển giao (handoff) xảy ra tự động khi admin online hoặc khi bot confidence thấp

**Lợi ích:** Giảm tải cho admin, phục vụ 24/7, thời gian phản hồi gần như tức thì.

### 1.2 Real-time Communication — Socket.IO

Socket.IO sử dụng **WebSocket** với fallback về HTTP long-polling, đảm bảo kết nối ổn định trên mọi trình duyệt.

**Room-based routing:**
- Mỗi user có room riêng: `String(userId)` — cô lập tin nhắn, không lọt sang user khác
- Admin join `admin_chat_room` — broadcast tới tất cả admin đang online cùng lúc

**Tại sao không dùng REST polling?**  
Polling (gọi API mỗi N giây) lãng phí băng thông và tạo độ trễ. WebSocket duy trì kết nối liên tục, server push tin nhắn ngay khi có — lý tưởng cho real-time UX.

### 1.3 Admin Presence Detection — In-memory Map

Thay vì lưu trường `isOnline: Boolean` vào User model trong MongoDB, hệ thống dùng **in-memory Map** trong Node.js process:

```js
const adminSockets = new Map(); // socketId → userId
```

**Lý do:**
- Không cần DB write/read cho mỗi connect/disconnect (giảm I/O)
- Tự động clean-up khi process restart (không cần cron job đặt lại `isOnline=false`)
- Độ trễ kiểm tra O(1) — constant time

**Hạn chế:** Không hoạt động trong môi trường multi-process (cluster mode). Khi scale, cần dùng Redis pub/sub hoặc Redis SET với TTL.

---

## 2. Intent Detection — Keyword Scoring

### 2.1 Tại sao không dùng ML?

Các phương pháp NLP nặng như PhoBERT, BERT, hay transformer-based classifiers đòi hỏi:
- Tập dữ liệu training hàng nghìn mẫu (chưa có)
- Thời gian training + inference latency (~200-500ms)
- RAM/CPU cao (không phù hợp cho server nhỏ)

**Keyword scoring** phù hợp hơn cho giai đoạn MVP:
- Triển khai ngay không cần data
- Latency < 1ms
- Dễ thêm/sửa keyword khi cần mở rộng
- Đủ chính xác cho domain hẹp (bán điện thoại)

### 2.2 Thuật toán Keyword Scoring

**Công thức tính score:**

```
score(intent) = (số_keyword_khớp / tổng_keyword) × weight
```

Một intent thắng khi: `score ≥ threshold` và `score > score của các intent khác`.

**Ví dụ:**

```
text = "đơn hàng của tôi đâu rồi"
intent check_order có 12 keywords, khớp: ["đơn hàng", "tôi"]  → 2 khớp
score = (2/12) × 1.3 = 0.2167  ≥ threshold 0.08  → WIN
```

**Tham số điều chỉnh:**

| Tham số | Ý nghĩa |
|---------|---------|
| `weight` | Ưu tiên intent quan trọng hơn (check_order=1.3 cao hơn greeting=1.0) |
| `threshold` | Ngưỡng tối thiểu để accept. Thấp hơn → nhạy hơn nhưng dễ false positive |

### 2.3 Word-Boundary Matching

Vấn đề substring: `"hi"` là substring của `"ship"`, `"this"`, `"while"` → false positive.

**Giải pháp — Space Padding:**

```python
def _kw_match(keyword: str, padded_text: str) -> bool:
    return f" {keyword} " in padded_text

# Sử dụng:
padded = f" {text_lower} "   # " ship " — có dấu cách bao quanh
_kw_match("hi", padded)      # " hi " in " ship " → False ✓
_kw_match("ship", padded)    # " ship " in " ship " → True ✓
```

Đây là kỹ thuật đơn giản nhưng hiệu quả, tương đương `\bword\b` regex nhưng nhanh hơn vì không dùng regex engine.

**Hoạt động tốt với:**
- Từ tiếng Anh đơn lẻ: `ship`, `hi`, `cod`, `vnpay`
- Cụm từ tiếng Việt: `giao hàng`, `mã giảm giá`, `đơn hàng`

**Hạn chế:** Không xử lý được biến thể hình thái học tiếng Việt (ví dụ: `"giao"` không match `"giao hàng"`). Giải quyết bằng cách thêm các dạng biến thể vào danh sách keyword.

---

## 3. Token Passthrough — Xác thực thay user

### 3.1 Vấn đề

Bot cần gọi API `/api/orders`, `/api/wallet/balance` với quyền của user đang chat, không phải quyền bot/server.

### 3.2 Giải pháp — JWT Passthrough

```
User Browser → chat:send { text, userToken: localStorage.accessToken }
                   ↓
Node.js socket handler → callPythonBot(text, userToken, sessionId)
                              ↓
Python Bot POST /chat { text, user_token, session_id }
                              ↓
actions.py → GET /api/orders
             headers: { Authorization: "Bearer <user_token>" }
```

**Tại sao an toàn?**
- Token không bao giờ lưu phía bot (stateless)
- Bot chỉ dùng token cho API call trong vòng xử lý request hiện tại
- Nếu token hết hạn → API trả 401 → bot reply "Vui lòng đăng nhập lại"

**Lưu ý bảo mật:** Kết nối Node.js → Python bot ở localhost, không expose ra internet. Trong production nên thêm secret header để xác thực request thực sự đến từ Node.js.

---

## 4. Action System — Quick-Reply Buttons

### 4.1 Cấu trúc Action

Mỗi tin nhắn bot có thể kèm danh sách `actions[]`:

```json
{
  "text": "Bạn muốn làm gì tiếp theo?",
  "actions": [
    { "label": "Xem đơn hàng", "type": "navigate", "payload": "/orders" },
    { "label": "Tìm sản phẩm", "type": "trigger_intent", "payload": "tôi muốn tìm sản phẩm" }
  ]
}
```

### 4.2 Hai loại Action

**`navigate`** — Điều hướng SPA:
```js
// ChatWidget.jsx
navigate(action.payload);   // React Router useNavigate()
setIsOpen(false);           // đóng chat panel
```

**`trigger_intent`** — Gửi text mẫu vào chat:
```js
sendMessage(action.payload);  // socket emit chat:send
```
Cho phép user chọn quick-reply → bot xử lý như text input thông thường, không cần hardcode case đặc biệt.

### 4.3 Tại sao dùng Action thay vì hardcode URL?

- Bot không cần biết cấu trúc route frontend
- Frontend có thể thay đổi URL mà không sửa bot
- Dễ thêm loại action mới (ví dụ: `open_modal`, `add_to_cart`) mà không sửa bot

---

## 5. Microservice Architecture — Python + Node.js

### 5.1 Tách biệt trách nhiệm

| Service | Trách nhiệm | Ngôn ngữ |
|---------|------------|---------|
| Node.js | Auth, DB, business logic, real-time | JavaScript |
| Python Bot | NLP, intent detection, response generation | Python |

**Lý do tách:**
- Python có ecosystem NLP tốt hơn (NLTK, spaCy, Hugging Face, underthesea)
- Node.js giữ nguyên — không cần refactor business logic hiện có
- Bot có thể scale độc lập (ví dụ: nhiều instance bot sau load balancer)
- Dễ nâng cấp bot (thêm ML model) mà không ảnh hưởng backend chính

### 5.2 Communication Pattern — Synchronous HTTP

Node.js gọi Python bot qua **HTTP POST** (REST), không phải message queue.

```js
const controller = new AbortController();
setTimeout(() => controller.abort(), 8000);   // 8s timeout

const res = await fetch('http://localhost:8000/chat', {
  method: 'POST',
  signal: controller.signal,
  body: JSON.stringify({ text, user_token, session_id })
});
```

**Graceful fallback:**
```js
catch (err) {
  return "Xin lỗi, hệ thống đang bảo trì. Vui lòng thử lại sau.";
}
```

**Tại sao không dùng message queue (Redis, RabbitMQ)?**
- Chat yêu cầu reply ngay (<2 giây) — async queue thêm độ trễ không cần thiết
- Độ phức tạp cao hơn mà không có lợi ích rõ ràng ở quy mô nhỏ

### 5.3 FastAPI — Tại sao chọn?

| Tiêu chí | FastAPI | Flask | Django |
|---------|---------|-------|--------|
| Async native | ✅ (ASGI) | ❌ (WSGI) | ❌ (WSGI) |
| Auto docs (Swagger) | ✅ | ❌ | ❌ |
| Type hints + Pydantic | ✅ | ❌ | ❌ |
| Hiệu năng | Cao nhất | Trung bình | Thấp nhất |

FastAPI phù hợp vì: cần async (để gọi httpx async khi fetch API), type safety với Pydantic models, và docs tự động hữu ích khi debug.

---

## 6. Frontend — Floating Chat Widget

### 6.1 Socket Singleton Pattern

Vấn đề: `useSocket.js` (notifications) và `useChatSocket.js` (chat) đều cần socket — nếu mỗi hook tạo socket riêng sẽ có 2 kết nối trùng.

**Giải pháp — Singleton Module:**

```js
// socketInstance.js
let _socket = null;

export const getSocket = () => {
  if (!_socket) {
    _socket = io(SOCKET_URL, { autoConnect: false });
  }
  return _socket;
};
```

JavaScript module system đảm bảo `_socket` chỉ được khởi tạo một lần trên toàn app (module được cache sau lần import đầu tiên).

### 6.2 UX Decisions

**Typing indicator (3 dots animation):**  
Báo hiệu bot đang "suy nghĩ" — giảm cảm giác đợi, làm bot có vẻ tự nhiên hơn.

**Unread badge trên toggle button:**  
User không cần mở chat widget để biết có tin nhắn mới. Badge tự xóa khi mở widget.

**Quick-reply buttons:**  
Giảm effort cho user (không cần gõ), hướng dẫn luồng conversation, tăng tỷ lệ engagement.

**Position `bottom-6 right-20`:**  
Đặt cạnh BackToTop (`bottom-6 right-6`) thay vì chồng lên — tránh overlap, cả hai nút đều accessible.

**Login prompt cho unauthenticated user:**  
Bot không có ích nếu user chưa đăng nhập (không lấy được token cho API calls). Thay vì disable chat, hiển thị nút "Đăng nhập để chat" — dẫn user vào funnel.

---

## 7. Scalability — Hướng nâng cấp

### Ngắn hạn (cải thiện không đổi kiến trúc)
- Thêm **context window**: lưu 5 tin nhắn gần nhất trong bot request để xử lý multi-turn
- Thêm **confidence threshold**: nếu score < 0.05 trên tất cả intent → hỏi lại user thay vì fallback
- Cache sản phẩm phổ biến trong bot (Redis) để giảm API calls

### Trung hạn (thay đổi bot)
- Tích hợp **PhoBERT** (BERT tiếng Việt từ VinAI) cho intent classification chính xác hơn
- Dùng **underthesea** (NLP library tiếng Việt) cho tokenization + NER (nhận dạng tên thương hiệu)
- Thêm **slot filling**: bot hỏi thêm nếu thiếu thông tin (ví dụ: "Bạn muốn tìm iPhone màu gì?")

### Dài hạn (thay đổi kiến trúc)
- **Redis pub/sub** cho admin presence nếu dùng cluster Node.js nhiều process
- **Vector database** (Qdrant, Weaviate) + embeddings cho semantic search intent
- **LLM integration** (GPT-4o mini hoặc Claude Haiku) làm fallback khi keyword không match
