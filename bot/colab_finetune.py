# ============================================================
# PhoneStore Chatbot — Fine-tuning trên Google Colab
# Model: Qwen2.5-3B-Instruct  |  Method: QLoRA (4-bit)
# Thời gian: ~30-60 phút trên Colab T4 (GPU miễn phí)
#
# HƯỚNG DẪN:
# 1. Mở Google Colab: colab.research.google.com
# 2. Runtime → Change runtime type → GPU (T4)
# 3. Upload file này + bot/data/train.jsonl lên Colab
# 4. Chạy từng cell theo thứ tự
# ===============================
# =============================

# CELL 1
# !pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git" -q
# !pip install datasets -q
# print("Done!")

# CELL 2
import unsloth
from unsloth import FastLanguageModel
import torch

MAX_SEQ_LENGTH = 2048
DTYPE = None
LOAD_IN_4BIT = True    # QLoRA — tiết kiệm VRAM

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Qwen2.5-3B-Instruct",
    max_seq_length=MAX_SEQ_LENGTH,
    dtype=DTYPE,
    load_in_4bit=LOAD_IN_4BIT,
)

print("Model loaded:", model.config.model_type)
print("VRAM used:", round(torch.cuda.memory_allocated() / 1e9, 2), "GB")

# CELL 3
model = FastLanguageModel.get_peft_model(
    model,
    r=16,                         # LoRA rank — 16 là cân bằng tốt
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    lora_alpha=16,
    lora_dropout=0,               # 0 = nhanh nhất với Unsloth
    bias="none",
    use_gradient_checkpointing="unsloth",   # tiết kiệm VRAM
    random_state=42,
    use_rslora=False,
    loftq_config=None,
)
print("LoRA params:", sum(p.numel() for p in model.parameters() if p.requires_grad))

# CELL 4
from datasets import load_dataset

DATASET_FILE = "train_real.jsonl"

dataset = load_dataset("json", data_files=DATASET_FILE, split="train")
print(f"Total examples: {len(dataset)}")

sample_text = dataset[0]["text"]
assert "<|im_start|>system" in sample_text, "Dataset format sai, kiểm tra lại file jsonl"
print("Sample formatted:\n", sample_text[:300], "...\n")

# CELL 5: Training
from trl import SFTTrainer, SFTConfig
from unsloth import is_bfloat16_supported

trainer = SFTTrainer(
    model=model,
    processing_class=tokenizer,
    train_dataset=dataset,
    args=SFTConfig(
        dataset_text_field="text",
        max_seq_length=MAX_SEQ_LENGTH,
        packing=False,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        warmup_steps=10,
        num_train_epochs=8,
        learning_rate=2e-4,
        fp16=not is_bfloat16_supported(),
        bf16=is_bfloat16_supported(),
        logging_steps=10,
        optim="adamw_8bit",
        weight_decay=0.01,
        lr_scheduler_type="linear",
        seed=42,
        output_dir="outputs",
        report_to="none",
    ),
)

gpu_stats = torch.cuda.get_device_properties(0)
print(f"GPU: {gpu_stats.name}, VRAM: {round(gpu_stats.total_memory / 1e9, 3)} GB")

trainer_stats = trainer.train()
print(f"\nTraining done! Time: {trainer_stats.metrics['train_runtime']:.0f}s")
print(f"Loss cuoi: {trainer_stats.metrics['train_loss']:.4f}")

# CELL 6: Test nhanh
FastLanguageModel.for_inference(model)

SYSTEM_PROMPT = """Bạn là trợ lý AI của PhoneStore - cửa hàng điện thoại uy tín tại Việt Nam.

Chính sách cửa hàng:
- Bảo hành: 12 tháng chính hãng, đổi mới trong 7 ngày nếu lỗi nhà sản xuất
- Giao hàng: 1-2 ngày nội thành, 2-5 ngày tỉnh thành khác. Phí 30.000₫, miễn phí khi mua từ 500.000₫
- Thanh toán: COD, chuyển khoản ngân hàng, VNPay, ví điện tử PhoneStore, trả góp 0%
- Đổi trả: 7 ngày, hoàn tiền về ví trong 24 giờ
- Hotline: 1800 6789 (8h-22h hàng ngày)
- Email: support@phonestore.vn
- Địa chỉ: 123 Nguyễn Văn Linh, Quận 7, TP.HCM

Hướng dẫn:
- Xưng là PhoneStore hoặc mình, gọi khách là bạn
- Ngắn gọn, thân thiện, tiếng Việt tự nhiên
- Với đơn hàng/ví/mã cụ thể: hướng dẫn đăng nhập hoặc dùng thông tin được cung cấp bên dưới

QUY TẮC QUAN TRỌNG VỀ GIÁ VÀ SẢN PHẨM:
- Khi có mục "Thông tin tra cứu thực tế" bên dưới, CHỈ dùng thông tin đó để trả lời về giá, tồn kho, màu sắc, thông số.
- KHÔNG tự bịa giá hoặc thông tin sản phẩm từ kiến thức bên ngoài.
- Nếu sản phẩm khách hỏi KHÔNG có trong danh sách tra cứu, hãy nói "PhoneStore hiện chưa có sản phẩm này" thay vì đưa ra giá sai."""

test_messages = [
    {"role": "system", "content": SYSTEM_PROMPT},
    {"role": "user",   "content": "Cho mình xem điện thoại Samsung tầm 10 triệu"},
]

inputs = tokenizer.apply_chat_template(
    test_messages, tokenize=True, add_generation_prompt=True, return_tensors="pt"
).to("cuda")

outputs = model.generate(
    input_ids=inputs,
    max_new_tokens=300,
    temperature=0.7,
    top_p=0.9,
    repetition_penalty=1.1,
)
response = tokenizer.decode(outputs[0][inputs.shape[1]:], skip_special_tokens=True)
print("BOT:", response)

# CELL 7
model.save_pretrained("phonestore-lora")
tokenizer.save_pretrained("phonestore-lora")
print("Saved LoRA adapter to phonestore-lora/")

# CELL 8: Export GGUF (chạy với Ollama)
model.save_pretrained_gguf(
    "phonestore-bot",
    tokenizer,
    quantization_method="q4_k_m",
)
import glob
gguf_files = glob.glob("phonestore-bot/**/*.gguf", recursive=True)
print("GGUF files:", gguf_files)

# CELL 9: 
from google.colab import drive
import shutil, os, glob

drive.mount("/content/drive", force_remount=True)  # sẽ hiện popup xác thực

dest = "/content/drive/MyDrive/phonestore-bot"
os.makedirs(dest, exist_ok=True)

# Tìm GGUF trong tất cả subfolder
gguf_candidates = glob.glob("**/*.gguf", recursive=True)
print("Tìm thấy:", gguf_candidates)

if not gguf_candidates:
    raise FileNotFoundError("Không tìm thấy GGUF! Chạy lại Cell 8.")

gguf_src = gguf_candidates[0]
gguf_dst = f"{dest}/phonestore-bot-Q4_K_M.gguf"
print(f"Copying {gguf_src} → {gguf_dst} ...")
shutil.copy(gguf_src, gguf_dst)
print(f"✅ Done! File đã lưu tại Google Drive: {gguf_dst}")

# ── CELL 10: Hướng dẫn sau khi train ────────────────────────
print("""
============================================================
BUOC TIEP THEO (tren may tinh cua ban):
============================================================
1. Download file phonestore-bot-Q4_K_M.gguf tu Google Drive

2. Cai Ollama (neu chua co):
   https://ollama.com/download

3. Dung san file Modelfile.finetuned co trong bot/ (da co dung SYSTEM_PROMPT
   khop voi luc train, KHONG can tu tao Modelfile moi).

4. Import vao Ollama:
   ollama create phonestore-bot -f Modelfile.finetuned

5. Test thu:
   ollama run phonestore-bot "Xin chao shop!"

6. Cap nhat bot/llm.py de dung OLLAMA_MODEL=phonestore-bot
============================================================

Tóm tắt cách khởi động bot:
# 1. Đảm bảo Ollama đang chạy (thường tự chạy nền nếu đã cài app Ollama)
ollama list   # phải thấy "phonestore-bot"

# 2. Vào thư mục bot, chạy server
cd phone-store/bot
python main.py
# hoặc: uvicorn main:app --reload --port 8000

""")
