# Hướng dẫn Git cho dự án PhoneStore

Repo: https://github.com/lehoangtrian/DATN
Nhánh chính: `main` và `master` (hiện đang giống nhau, dùng nhánh nào cũng được — xem mục "Lưu ý về 2 nhánh" cuối file).

---

## 1. Trước khi bắt đầu làm việc mỗi ngày — luôn `pull` trước

Để chắc chắn code trên máy là bản mới nhất (tránh làm việc trên bản cũ rồi conflict):

```bash
cd D:\0_DATN\DATN
git pull
```

Nếu báo lỗi `error: Your local changes would be overwritten`, nghĩa là bạn đang có thay đổi chưa commit → xem mục 6 (Tạm lưu thay đổi) hoặc commit trước rồi pull lại.

---

## 2. Quy trình đẩy thay đổi lên GitHub (push)

```bash
git status                      # xem file nào đã sửa/thêm/xóa
git add -A                      # gom toàn bộ thay đổi
git commit -m "Mô tả ngắn gọn"  # lưu một mốc thay đổi
git push                        # đẩy lên GitHub
```

Mẹo viết commit message: nói **đã làm gì**, không cần dài.
Ví dụ: `fix: sửa lỗi không tính giảm giá flash sale`, `feat: thêm trang wishlist`.

Muốn xem trước nội dung thay đổi cụ thể (từng dòng) trước khi commit:

```bash
git diff
```

---

## 3. Lấy code mới nhất từ GitHub về (pull)

Khi có người khác (hoặc bạn từ máy khác) đã push code mới:

```bash
git pull
```

Nếu có conflict (Git không tự gộp được vì 2 bên sửa cùng 1 dòng), Git sẽ báo file bị conflict. Mở file đó, sẽ thấy đoạn dạng:

```
<<<<<<< HEAD
code của bạn
=======
code từ GitHub
>>>>>>> origin/main
```

Sửa tay để giữ lại phần đúng (xóa các dòng `<<<<<<<`, `=======`, `>>>>>>>`), lưu file, rồi:

```bash
git add <tên file đã sửa>
git commit -m "fix: resolve merge conflict"
git push
```

---

## 4. Clone dự án về máy mới (lần đầu)

```bash
git clone https://github.com/lehoangtrian/DATN.git
cd DATN/phone-store
cd client && npm install && cd ..
cd server && npm install && cd ..
```

Sau đó tạo lại các file `.env` (không có trên GitHub vì chứa secret — xem mục 7) và tải model `.gguf` riêng nếu cần chạy bot AI.

---

## 5. Xem lịch sử / kiểm tra trạng thái

```bash
git log --oneline -10     # 10 commit gần nhất
git log --oneline -10 --all   # cả các nhánh khác
git status                 # file nào đang thay đổi, đang ở nhánh nào
git diff                   # xem chi tiết thay đổi chưa commit
git branch -a              # xem tất cả nhánh (local + remote)
```

---

## 6. Tạm lưu thay đổi chưa muốn commit (`stash`)

Khi đang sửa nửa chừng mà cần `pull` gấp hoặc đổi nhánh:

```bash
git stash           # cất tạm thay đổi hiện tại, trả lại working tree sạch
git pull
git stash pop        # lấy lại thay đổi đã cất
```

---

## 7. Những gì KHÔNG được đẩy lên GitHub (đã có trong `.gitignore`)

| Loại | Lý do |
|---|---|
| `node_modules/`, `dist/` | Cài lại bằng `npm install` / build lại bằng `npm run build` |
| `.env` (server, client, bot) | Chứa secret (JWT_SECRET, Mongo URI...) — phải tự tạo lại theo các biến đang dùng trong code, không chia sẻ qua Git |
| `*.gguf`, `*.bin`, `*.safetensors` | Model AI quá lớn (>100MB), GitHub chặn. Lưu riêng (Google Drive, Hugging Face Hub...) |
| `server/logs/`, `server/uploads/*` (trừ `.gitkeep`) | File runtime, không phải source code |
| `DB_Mongo/` | Bản dump database (chứa password hash, dữ liệu user/order) — không đẩy lên repo public để tránh rò rỉ dữ liệu, dù là dữ liệu test |

Nếu lỡ `git add` một file `.env` hoặc file lớn: **đừng commit** — bỏ ra bằng `git restore --staged <file>` rồi thêm dòng loại trừ vào `.gitignore`.

---

## 8. Lỗi thường gặp khi push

| Lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| `rejected (fetch first)` | Có commit mới trên GitHub mà máy bạn chưa có | `git pull` rồi `git push` lại |
| Hỏi đăng nhập / permission denied | Tài khoản đang đăng nhập không có quyền ghi vào repo | Đăng nhập đúng tài khoản có quyền (collaborator) của `lehoangtrian/DATN` |
| `file exceeds GitHub's file size limit` | Lỡ thêm file >100MB | `git reset --soft HEAD~1` để bỏ commit đó, gỡ file ra, thêm vào `.gitignore`, commit lại |

---

## 9. Làm tính năng lớn trên nhánh riêng (khuyến nghị khi nhiều người cùng sửa)

```bash
git checkout -b ten-tinh-nang     # tạo + chuyển sang nhánh mới
# ... sửa code, add, commit như mục 2 ...
git push -u origin ten-tinh-nang
```

Sau đó vào GitHub tạo Pull Request để gộp (merge) vào `main` khi đã xong và kiểm tra kỹ.

Quay lại nhánh chính: `git checkout main`

---

## Lưu ý về 2 nhánh `main` và `master`

Repo này có cả `main` và `master`, hiện tại đang trỏ tới cùng một commit (cùng nội dung). Để tránh nhầm lẫn về sau, nên **chọn 1 nhánh duy nhất làm nhánh chính** và chỉ push vào đó (khuyến nghị `main`, vì GitHub mặc định coi `main` là nhánh chính). Nếu cả nhóm thống nhất chỉ dùng `main`, có thể xóa `master` trên GitHub bằng:

```bash
git push origin --delete master
```

(Chỉ làm khi đã chắc chắn không ai còn cần `master` nữa.)
