# reversing-diff Writeup

## 問題概要

バイナリファイル `files/diff_2026_60bed1d04f20d1271bdf19bce9ee4aec` を解析し、可能な限り一致するC++ソースコードを書いてコンパイルする「diffチャレンジ」。スコアはコンパイル結果と元バイナリのバイト差分（低いほど良い）。

- ビルドコマンド: `docker run --rm -v $(pwd):/code hakatashi/diff-challenge-cpp /tmp/build.sh /code/input.cpp /code/output`
- スコアコマンド: `docker run --rm -v $(pwd):/code hakatashi/diff-challenge-base /tmp/compare /code/binary1 /code/binary2`

## 最終スコア

**0点（完全一致）**

## 解析手順

### 1. バイナリの基本情報確認

```
file: ELF 64-bit LSB pie executable, x86-64, dynamically linked, not stripped
```

`not stripped` なので関数名・シンボル情報が残っていた。`nm`, `strings`, `objdump` で解析を開始。

### 2. 文字列・シンボルの確認

`.rodata` に `"Enter limit: "`, `":"`, `" "`, `"\n"` が格納されており、数値列を表示するプログラムと判断。

シンボルテーブルから主要関数を特定:
- `main`: メイン関数
- `_ZZ4mainENHUlT_xE_clIS0_EEiS_x`: C++23 "deducing this" ラムダの `operator()`

### 3. アセンブリ解析

`objdump -d` でメイン関数を解析。主な発見:

#### C++23 "deducing this" ラムダ
マングル名 `_ZZ4mainENHUlT_xE_clIS0_EEiS_x` の `H` プレフィックスと `UlT_xE_` のパターンから、C++23の `this auto self` 構文を使ったラムダと判定。

```cpp
auto collatz = [](this auto self, long long n) -> int { ... };
```

#### Collatz アルゴリズム
ラムダの本体を逆アセンブルして、コラッツ数列のステップ数を計算していることを確認:
- `n <= 1` → 0 を返す
- `n % 2 == 0` → `self(n/2) + 1`
- 奇数 → `self(3*n+1) + 1`

#### std::ranges::views::enumerate
- `_ZNSt6ranges5views9__adaptororI...` の呼び出しから、`vec | std::ranges::views::enumerate` のパイプ構文を確認
- 関数呼び出し順序（`rdi`=vec, `rsi`=enumerate オブジェクト）からパイプ演算子使用を特定

#### std::views::iota
`_ZNKSt6ranges5views5_IotaclIiiEEDaOT_OT0_` の呼び出しから `std::views::iota(1, n+1)` を確認。

### 4. イテレーション経緯とスコア変化

| 変更内容 | スコア |
|---------|--------|
| 初期実装（`std::views::enumerate(vec)` 直接呼び出し） | 2232 |
| パイプ構文 `vec \| std::ranges::views::enumerate` に変更 | 920 |
| 32ビット剰余演算: `int cnt = (int)(index + 1); if (cnt % 5 == 0)` | 66 |
| `std::vector<int> vec;` を `if` チェック後に移動（→元に戻す） | 90 |
| **コラッツラムダをvecより先に宣言** | **0** |

### 5. 最後の壁: スタックレイアウト差異

スコア66の時点で残り34バイトの差分があった:
- 20バイト: ビルドID (`.note.gnu.build-id`) — コード一致で自動解消
- 14バイト: スタックオフセット差異

差分の内訳:
- `vec` のスタック位置: `-0x70(%rbp)` (元) vs `-0x60(%rbp)` (自分)
- `iota_view` の位置: `-0x78(%rbp)` vs `-0x6c(%rbp)`
- `iota_begin` の位置: `-0x7c(%rbp)` vs `-0x70(%rbp)`
- `iota_end` の位置: `-0x80(%rbp)` vs `-0x74(%rbp)`

### 6. スタックレイアウト差異の根本原因分析

詳細な解析の結果、GCCのスタックアロケータがRTL（Register Transfer Language）ノードの処理順に変数を割り当てることが判明。

`auto collatz = [...]` をvecより前に宣言すると、GCCのスタックアロケータが変数割り当て順序を変え、`std::vector<int> vec` が16バイト整列要件に従って `-0x70(%rbp)` に配置された。

逆に `vec` を先に宣言すると `-0x60(%rbp)` に配置され、以下の連鎖的なズレが生じた:
- `vec` が16バイト低い位置に
- `iota_view` が12バイト低い位置に（tuple の16バイトアライメント要件との相互作用）
- `iota_begin/end` も同様にズレ

### 7. 最終ソースコード

```cpp
#include <iostream>
#include <vector>
#include <ranges>

int main() {
    std::cout << "Enter limit: ";
    int n;
    std::cin >> n;

    if (n <= 0) return 1;

    auto collatz = [](this auto self, long long n) -> int {
        if (n <= 1) return 0;
        if (n % 2 == 0) return self(n / 2) + 1;
        else return self(3 * n + 1) + 1;
    };

    std::vector<int> vec;

    for (int i : std::views::iota(1, n + 1)) {
        vec.push_back(collatz(i));
    }

    for (auto [index, val] : vec | std::ranges::views::enumerate) {
        std::cout << (index + 1) << ":" << val << " ";
        int cnt = (int)(index + 1);
        if (cnt % 5 == 0) std::cout << "\n";
    }

    return 0;
}
```

## 学んだこと

1. **C++23 "deducing this"**: マングル名の `H` プレフィックスで識別可能
2. **ranges パイプ構文**: `|` と直接関数呼び出しでは生成されるアセンブリが大幅に異なる
3. **32ビット剰余**: インデックスを `int` にキャストしてから剰余を取ることでGCCが32ビット乗算除算を使用
4. **GCCスタックアロケータ**: 変数宣言順序がスタックレイアウトに影響し、特に16バイトアライメント要件のある `std::vector` の配置位置が変わる
