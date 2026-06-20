# Hướng dẫn Git cho dự án PhoneStore (A-Z)

Repo: https://github.com/lehoangtrian/DATN
Nhánh chính: `main` (khuyến nghị dùng nhánh này — xem mục cuối "Lưu ý về 2 nhánh main/master").

Tài liệu này viết cho người **chưa rành Git** — đọc từ đầu xuống cuối là dùng được, hoặc nhảy thẳng tới mục cần tra.

---

## Mục lục

0. [Vài khái niệm cần biết trước](#0-vài-khái-niệm-cần-biết-trước)
1. [Cài đặt Git lần đầu trên máy mới](#1-cài-đặt-git-lần-đầu-trên-máy-mới)
2. [Clone dự án về máy (lần đầu)](#2-clone-dự-án-về-máy-lần-đầu)
3. [Quy trình làm việc hằng ngày](#3-quy-trình-làm-việc-hằng-ngày)
4. [Pull — lấy code mới nhất về](#4-pull--lấy-code-mới-nhất-về)
5. [Push — đẩy code lên GitHub](#5-push--đẩy-code-lên-github)
6. [Xử lý conflict khi pull/merge](#6-xử-lý-conflict-khi-pullmerge)
7. [Làm việc với nhánh (branch)](#7-làm-việc-với-nhánh-branch)
8. [Tạm lưu thay đổi (stash)](#8-tạm-lưu-thay-đổi-stash)
9. [Hoàn tác (undo) các loại](#9-hoàn-tác-undo-các-loại)
10. [Xem lịch sử / kiểm tra trạng thái](#10-xem-lịch-sử--kiểm-tra-trạng-thái)
11. [Những gì KHÔNG được đẩy lên GitHub](#11-những-gì-không-được-đẩy-lên-github)
12. [Quy ước viết commit message](#12-quy-ước-viết-commit-message)
13. [Lỗi thường gặp và cách xử lý](#13-lỗi-thường-gặp-và-cách-xử-lý)
14. [Lưu ý về 2 nhánh main/master](#14-lưu-ý-về-2-nhánh-mainmaster)
15. [Cheat sheet — tra nhanh](#15-cheat-sheet--tra-nhanh)

---

## 0. Vài khái niệm cần biết trước

| Từ | Nghĩa |
|---|---|
| **Repository (repo)** | Thư mục dự án được Git theo dõi thay đổi (có thư mục `.git` ẩn bên trong) |
| **Remote** | Bản repo nằm trên GitHub (gọi tắt là `origin`) — khác với bản trên máy bạn (local) |
| **Commit** | Một "mốc lưu" thay đổi, có mô tả kèm theo. Giống như 1 save point trong game |
| **Branch (nhánh)** | Một đường phát triển code riêng. `main` là nhánh chính, có thể tạo nhánh phụ để làm tính năng mới mà không ảnh hưởng nhánh chính |
| **Working tree** | Các file thật trên đĩa mà bạn đang sửa |
| **Staging area / index** | "Khu vực tạm" — nơi bạn chọn những thay đổi nào sẽ được đưa vào commit tiếp theo (qua `git add`) |
| **HEAD** | Con trỏ chỉ tới commit/nhánh bạn đang đứng (đang ở đâu trong lịch sử) |

Luồng dữ liệu cơ bản:

```
working tree --(git add)--> staging area --(git commit)--> local repo --(git push)--> GitHub (remote)
```

---

## 1. Cài đặt Git lần đầu trên máy mới

1. Cài Git: https://git-scm.com/downloads (Windows chọn bản Git for Windows)
2. Khai báo tên/email — Git dùng để ghi vào mỗi commit (không cần trùng email GitHub):

```bash
git config --global user.name "Tên của bạn"
git config --global user.email "email@cuaban.com"
```

3. (Lần đầu push) GitHub sẽ yêu cầu đăng nhập — dùng **Personal Access Token** thay cho mật khẩu (GitHub không cho dùng mật khẩu thường để push qua HTTPS nữa). Tạo token tại: GitHub → Settings → Developer settings → Personal access tokens.

---

## 2. Clone dự án về máy (lần đầu)

```bash
git clone https://github.com/lehoangtrian/DATN.git
cd DATN/phone-store
cd client && npm install && cd ..
cd server && npm install && cd ..
```

Sau đó:
- Tạo lại các file `.env` (server, client, bot) — không có trên GitHub vì chứa secret, xem mục 11.
- Tải model `.gguf` riêng (Google Drive/Hugging Face) nếu cần chạy bot AI — model không nằm trên GitHub vì quá lớn.

---

## 3. Quy trình làm việc hằng ngày

```
1. git pull               # lấy code mới nhất trước khi sửa
2. ... sửa code ...
3. git status              # xem đã đổi gì
4. git add -A               # gom thay đổi vào staging area
5. git commit -m "..."       # lưu 1 mốc
6. git push                   # đẩy lên GitHub
```

Luôn `pull` trước khi bắt đầu sửa, và `push` ngay khi xong 1 việc nhỏ — tránh để dồn quá nhiều thay đổi rồi mới push 1 lần (dễ conflict, khó review).

---

## 4. Pull — lấy code mới nhất về

```bash
git pull
```

Lệnh này thực chất = `git fetch` (tải lịch sử mới từ GitHub) + `git merge` (gộp vào code hiện tại).

**Lỗi `Your local changes would be overwritten`**: bạn đang có thay đổi chưa commit ở file mà bản mới trên GitHub cũng sửa. Xử lý: commit thay đổi của bạn trước (mục 3), hoặc `git stash` tạm cất rồi pull (mục 8).

---

## 5. Push — đẩy code lên GitHub

Có **2 cách push** — mặc định luôn dùng cách 1, cách 2 chỉ dùng khi thật sự cần và hiểu rõ rủi ro.

### Cách 1 — Push cập nhật (an toàn, dùng hằng ngày)

Chỉ đẩy phần thay đổi mới lên, **giữ nguyên lịch sử cũ** trên GitHub.

```bash
git add -A
git commit -m "Mô tả thay đổi"
git push origin main
```

Điều kiện: local phải đã có đủ lịch sử của remote (đã pull trước). Nếu remote có commit mà local chưa có → bị từ chối `rejected (fetch first)` để tránh làm mất commit người khác → `git pull` rồi push lại.

### Cách 2 — Push thay thế hoàn toàn (force push — ⚠️ nguy hiểm)

Bắt remote phải **giống y local hiện tại**, xóa sạch mọi commit trên GitHub mà local không có. Dùng khi: chắc chắn local là bản đúng/mới nhất tuyệt đối, muốn loại bỏ hẳn lịch sử cũ trên GitHub (ví dụ: lịch sử cũ bị lỗi, có commit rác, hoặc setup lại repo từ đầu).

```bash
git add -A
git commit -m "Mô tả thay đổi"
git push --force origin main
```

**Rủi ro**: nếu GitHub có commit nào mà local chưa có (người khác vừa push, hoặc bạn dùng máy khác push trước) — force push sẽ **xóa vĩnh viễn** commit đó, không khôi phục được trừ khi ai đó còn giữ bản local cũ.

An toàn hơn — dùng `--force-with-lease` thay cho `--force` thuần:

```bash
git push --force-with-lease origin main
```

Lệnh này sẽ **tự từ chối** nếu phát hiện remote có commit mới hơn lần bạn fetch gần nhất (tức có ai vừa push thêm) — tránh đè nhầm lên công việc của người khác mà không biết.

> **Tóm gọn**: làm việc nhóm/hằng ngày → luôn Cách 1. Chỉ dùng Cách 2 khi chủ động muốn ghi đè toàn bộ và đã chắc chắn không ai có commit cần giữ trên remote.

---

## 6. Xử lý conflict khi pull/merge

Khi 2 bên sửa cùng 1 dòng của 1 file, Git không tự gộp được — báo file bị conflict, mở file đó sẽ thấy:

```
<<<<<<< HEAD
code của bạn (bản local)
=======
code từ GitHub (bản remote)
>>>>>>> origin/main
```

Cách xử lý:
1. Đọc kỹ cả 2 đoạn, quyết định giữ đoạn nào (hoặc gộp cả 2 ý).
2. Xóa hết 3 dòng đánh dấu (`<<<<<<<`, `=======`, `>>>>>>>`), chỉ để lại code đúng.
3. Lưu file, rồi:

```bash
git add <tên file đã sửa>
git commit -m "fix: resolve merge conflict"
git push
```

Muốn hủy merge đang conflict, quay lại trạng thái trước khi pull:

```bash
git merge --abort
```

---

## 7. Làm việc với nhánh (branch)

Dùng khi muốn làm 1 tính năng lớn mà không ảnh hưởng tới `main` đang chạy ổn, đặc biệt khi nhiều người cùng sửa code.

```bash
git checkout -b ten-tinh-nang     # tạo nhánh mới + chuyển sang nhánh đó luôn
# ... sửa code, add, commit như mục 3 ...
git push -u origin ten-tinh-nang   # lần đầu push nhánh mới cần -u (gắn theo dõi)
```

Sau đó vào GitHub tạo **Pull Request** để xem trước thay đổi rồi gộp (merge) vào `main` khi đã kiểm tra kỹ — tốt hơn merge thẳng vì có thể review code trước.

Các lệnh khác liên quan tới nhánh:

```bash
git branch                  # xem các nhánh local, dấu * là nhánh đang đứng
git branch -a                # xem cả nhánh local + remote
git checkout main             # chuyển về nhánh main
git checkout ten-nhanh         # chuyển sang 1 nhánh đã có
git branch -d ten-nhanh         # xóa nhánh local đã merge xong (an toàn)
git branch -D ten-nhanh          # xóa ép nhánh local dù chưa merge (cẩn thận mất code)
git push origin --delete ten-nhanh  # xóa nhánh trên GitHub
```

Merge 1 nhánh khác vào nhánh đang đứng (ít dùng nếu đã quen Pull Request):

```bash
git checkout main
git merge ten-tinh-nang
```

---

## 8. Tạm lưu thay đổi (stash)

Khi đang sửa code nửa chừng mà cần `pull` gấp hoặc đổi nhánh, nhưng chưa muốn commit:

```bash
git stash              # cất tạm thay đổi hiện tại, trả lại working tree sạch
git pull                # hoặc git checkout nhánh khác
git stash pop            # lấy lại thay đổi đã cất, áp vào working tree
```

Các lệnh khác:

```bash
git stash list           # xem các lần đã stash (có thể stash nhiều lần)
git stash apply           # lấy lại thay đổi nhưng KHÔNG xóa khỏi danh sách stash
git stash drop             # xóa 1 lần stash mà không áp dụng lại
git stash clear             # xóa hết toàn bộ stash
```

---

## 9. Hoàn tác (undo) các loại

| Muốn làm gì | Lệnh |
|---|---|
| Hủy sửa ở 1 file chưa `add` (về lại bản đã commit gần nhất) | `git checkout -- <file>` (hoặc `git restore <file>` ở Git mới) |
| Bỏ 1 file ra khỏi staging area (đã `add` nhưng chưa commit) | `git restore --staged <file>` |
| Sửa lại nội dung/message của commit **vừa tạo, chưa push** | `git commit --amend` |
| Bỏ commit cuối cùng nhưng **giữ lại thay đổi** (để sửa lại rồi commit lại) | `git reset --soft HEAD~1` |
| Bỏ hẳn commit cuối cùng **và xóa luôn thay đổi** (mất code, cẩn thận) | `git reset --hard HEAD~1` |
| Hủy bỏ 1 commit **đã push** (không xóa lịch sử, tạo commit mới đảo ngược — an toàn cho nhóm) | `git revert <mã-commit>` |
| Bỏ toàn bộ thay đổi chưa commit, quay về bản commit gần nhất (mất hết code chưa lưu, rất cẩn thận) | `git reset --hard HEAD` |

> `--hard` luôn là lệnh xóa thật, không khôi phục lại được trừ trường hợp đặc biệt (`git reflog`). Cân nhắc kỹ trước khi dùng.

---

## 10. Xem lịch sử / kiểm tra trạng thái

```bash
git status                    # file nào đang thay đổi, đang ở nhánh nào
git diff                        # xem chi tiết thay đổi chưa add (từng dòng +/-)
git diff --staged                # xem thay đổi đã add nhưng chưa commit
git log --oneline -10              # 10 commit gần nhất, rút gọn
git log --oneline -10 --all          # cả các nhánh khác
git log -p -3                          # 3 commit gần nhất kèm nội dung thay đổi chi tiết
git show <mã-commit>                     # xem nội dung 1 commit cụ thể
git branch -a                              # xem tất cả nhánh (local + remote)
```

---

## 11. Những gì KHÔNG được đẩy lên GitHub

Đã khai báo trong `.gitignore`:

| Loại | Lý do |
|---|---|
| `node_modules/`, `dist/` | Cài lại bằng `npm install` / build lại bằng `npm run build` |
| `.env` (server, client, bot) | Chứa secret (JWT_SECRET, Mongo URI...) — phải tự tạo lại theo biến đang dùng trong code, không chia sẻ qua Git |
| `*.gguf`, `*.bin`, `*.safetensors` | Model AI quá lớn (>100MB), GitHub chặn. Lưu riêng (Google Drive, Hugging Face Hub...) |
| `server/logs/`, `server/uploads/*` (trừ `.gitkeep`) | File runtime, không phải source code |
| `DB_Mongo/` | Bản dump database (chứa password hash, dữ liệu user/order) — không đẩy lên repo public để tránh rò rỉ dữ liệu, dù là dữ liệu test |

Nếu lỡ `git add` một file `.env` hoặc file lớn: **đừng commit** — bỏ ra bằng `git restore --staged <file>` rồi thêm dòng loại trừ vào `.gitignore`.

Nếu **đã commit rồi nhưng chưa push** — bỏ khỏi commit gần nhất:

```bash
git reset --soft HEAD~1
git restore --staged <file-nhạy-cảm>
# rồi thêm vào .gitignore, commit lại
```

Nếu **đã push lên GitHub rồi** — coi như secret đã bị lộ, phải đổi secret đó ngay (đổi JWT_SECRET, mật khẩu DB...), xóa file khỏi lịch sử bằng `git filter-repo` hoặc BFG Repo-Cleaner không đủ — secret cũ vẫn cần coi là không an toàn dù xóa khỏi lịch sử.

---

## 12. Quy ước viết commit message

Nói **đã làm gì**, không cần dài. Tiền tố gợi ý:

| Tiền tố | Dùng khi |
|---|---|
| `feat:` | Thêm tính năng mới |
| `fix:` | Sửa lỗi |
| `refactor:` | Tổ chức lại code, không đổi hành vi |
| `docs:` | Sửa tài liệu/hướng dẫn |
| `chore:` | Việc lặt vặt (cập nhật dependency, cấu hình...) |

Ví dụ: `fix: sửa lỗi không tính giảm giá flash sale`, `feat: thêm trang wishlist`.

---

## 13. Lỗi thường gặp và cách xử lý

| Lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| `rejected (fetch first)` | Có commit mới trên GitHub mà máy bạn chưa có | `git pull` rồi `git push` lại |
| Hỏi đăng nhập / `permission denied` | Tài khoản đang đăng nhập không có quyền ghi vào repo, hoặc dùng mật khẩu thay vì token | Dùng Personal Access Token (mục 1), đăng nhập đúng tài khoản collaborator của `lehoangtrian/DATN` |
| `file exceeds GitHub's file size limit` | Lỡ thêm file >100MB | `git reset --soft HEAD~1` để bỏ commit đó, gỡ file ra, thêm vào `.gitignore`, commit lại |
| `Your local changes would be overwritten` (khi pull) | Có thay đổi chưa commit ở file remote cũng sửa | Commit hoặc `git stash` trước rồi pull lại |
| `fatal: not a git repository` | Đang đứng ở thư mục không có `.git`, hoặc `.git` bị mất | Kiểm tra đang ở đúng thư mục dự án (`cd D:\0_DATN\DATN`); nếu mất `.git` thật, xem mục 2 (clone lại) hoặc liên hệ người giữ bản gốc |
| Conflict khi pull | 2 bên sửa cùng 1 dòng | Xem mục 6 |
| Commit nhầm file `.env`/file lớn | Quên kiểm tra trước khi `add -A` | Xem mục 11 |

---

## 14. Lưu ý về 2 nhánh main/master

Repo này từng có cả `main` và `master` cùng trỏ tới 1 commit. Nên **chỉ dùng 1 nhánh duy nhất làm nhánh chính** để tránh nhầm lẫn (khuyến nghị `main`, vì GitHub mặc định coi đây là nhánh chính). Nếu `master` không còn ai dùng, có thể xóa trên GitHub:

```bash
git push origin --delete master
```

(Chỉ làm khi đã chắc chắn không ai còn cần `master`, và không có thay đổi nào ở đó chưa được gộp vào `main`.)

---

## 15. Cheat sheet — tra nhanh

```bash
# Hằng ngày
git pull                          # lấy code mới
git status                         # xem đã đổi gì
git add -A                          # gom thay đổi
git commit -m "..."                   # lưu mốc
git push                                # đẩy lên (cập nhật, an toàn)

# Khi cần ghi đè hoàn toàn (cẩn thận!)
git push --force-with-lease origin main

# Xem lịch sử
git log --oneline -10
git diff

# Nhánh
git checkout -b ten-nhanh-moi
git push -u origin ten-nhanh-moi

# Cứu nguy
git stash / git stash pop          # cất/lấy lại thay đổi tạm
git restore --staged <file>          # bỏ add nhầm
git checkout -- <file>                 # hủy sửa file chưa add
git reset --soft HEAD~1                  # bỏ commit cuối, giữ thay đổi
```
