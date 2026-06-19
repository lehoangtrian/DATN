# Hướng dẫn cập nhật code lên GitHub

Repo: https://github.com/lehoangtrian/DATN (nhánh `main`)

## Mỗi lần muốn đẩy thay đổi mới lên GitHub

Mở terminal tại thư mục `phone-store/` rồi chạy:

```bash
git add -A
git commit -m "Mô tả ngắn về thay đổi"
git push
```

- `git add -A`: gom tất cả file đã sửa/thêm/xóa.
- `git commit -m "..."`: lưu lại một mốc thay đổi, kèm mô tả (viết ngắn gọn, nói rõ đã sửa gì).
- `git push`: đẩy lên GitHub.

## Kiểm tra trước khi commit (khuyến nghị)

```bash
git status      # xem file nào đang thay đổi
git diff        # xem nội dung thay đổi cụ thể
```

## Những gì KHÔNG được đẩy lên GitHub (đã cấu hình sẵn trong `.gitignore`)

- `node_modules/`, `dist/` — cài lại bằng `npm install` / `npm run build`
- `.env` (server, client, bot) — chứa secret (JWT_SECRET, Mongo URI...), phải tự tạo lại ở máy mới dựa theo các biến đang dùng trong code
- `*.gguf`, `*.bin`, `*.safetensors` — model AI quá lớn (>100MB), GitHub không nhận. Lưu riêng (Google Drive, Hugging Face...) nếu cần chia sẻ
- `server/logs/`, `server/uploads/*` (trừ `.gitkeep`)

Nếu thêm file `.env` mới hoặc file lớn (>100MB) mà vô tình bị `git add`, **không commit** — thêm dòng loại trừ vào `.gitignore` trước.

## Nếu thấy lỗi khi push

- `rejected (fetch first)`: có người khác (hoặc máy khác của bạn) đã push trước → chạy `git pull` rồi `git push` lại.
- Bị hỏi đăng nhập GitHub: dùng tài khoản có quyền ghi vào repo `lehoangtrian/DATN`.

## Tạo nhánh riêng khi làm tính năng lớn (tùy chọn, không bắt buộc)

```bash
git checkout -b ten-tinh-nang
# ... sửa code, commit như trên ...
git push -u origin ten-tinh-nang
```

Sau đó vào GitHub tạo Pull Request để gộp vào `main` khi xong.
