# hidden_structure - WRITEUP

## 問題概要

- ジャンル: Crypto (多変数多項式暗号 / MPKC)
- タイトル: hidden_structure
- フラグ: `TSGCTF{+oo_sim|*l3_t0_hide_5tructure_kxJwahTc4Ff0yq3rz/2}`

## 問題設定

有限体 GF(251) 上の多変数多項式暗号を用いた署名スキーム。

- 変数: 57個 (x0〜x6: フラグ接頭辞 "TSGCTF{" = 既知、x7〜x56: 未知)
- 中央写像 F: 50個の多項式。各 f_i は「三角構造」を持つ
  - f_i は x0〜x_{NV+i} にのみ依存（x_{NV+i+1}〜x56 には依存しない）
  - x_{NV+i}（油変数 o_i）の1次係数 α_i が 0 以外
  - 2次項は (a,b) で a,b < NV+i の組み合わせのみ
- 公開鍵 P = L * F（L はランダムな 50×50 行列）
- 問題: P(flag) = Y を満たす flag を求める

## 脆弱性の分析

「構造を隠すのが簡単すぎた」とは、線形変換 L を適用しても **o変数の1次係数行列が直接復元可能** であること。

公開鍵 P_coeffs[i][1+NV+k]（= p_i の o_k 1次係数）を成分とする 50×50 行列 B を考えると：

```
B[i][k] = (p_i の o_k 係数) = L[i][k] * α_k
```

つまり B = L * diag(α_0, ..., α_{49}) = L * A の形となる（A は下三角行列）。

## 攻撃手順

### Step 1: 行列 B の構築と逆行列計算

```
B[i][k] = P_coeffs[i][8 + k]   (= 1 + NV + k = 8 + k)
C = B^{-1}  (GF(251) 上)
```

### Step 2: 再スケール多項式 g̃_j の構築

```
g̃_j = Σ_i C[j][i] * p_i  = (A^{-1} * F)[j]
```

C * P = (L*A)^{-1} * L * F = A^{-1} * L^{-1} * L * F = A^{-1} * F

A は下三角行列なので A^{-1} も下三角行列。よって g̃_j は f_0, ..., f_j の線形結合であり、**o_{j+1}〜o_{49} を含まない**。

さらに (A^{-1} * A)[j][k] = δ_{j,k} より、g̃_j の **o_j の1次係数 = 1、他の o_k (k≠j) の1次係数 = 0**。

### Step 3: ドミノ倒し方式での解法

g̃_j(x0..x6, o_0, ..., o_{j-1}, o_j) = const_j' + o_j

既知変数と解済みの o_0, ..., o_{j-1} を代入すると：

```
o_j = (Σ_i C[j][i] * Y_i) - g̃_j(v, o_0, ..., o_{j-1}, 0, 0, ..., 0)  mod 251
```

j=0 から j=49 まで順次解くことで全変数が求まる。

## 実装 (solve.py)

```python
# B[i][k] = P_coeffs[i][1 + NV + k]
B = [[P_coeffs[i][1 + NV + k] for k in range(NO)] for i in range(M)]
C = mat_inv_gf(B, P_FIELD)  # GF(251)上での逆行列

# 再スケール多項式
g_tilde[j] = sum(C[j][i] * P_coeffs[i] for i in range(M))  # mod 251

# 順次解法
for j in range(NO):
    partial_x = known + [0] * (N - len(known))
    const_part = evaluate_polynomial(g_tilde[j], partial_x)
    o_j = (targets[j] - const_part) % P_FIELD
    known.append(o_j)
```

## 検証

```
P(flag) == Y: True
```

## まとめ

この問題の脆弱性は、中央写像 F の三角構造が **o変数の1次係数行列 A（下三角行列）** として公開鍵に直接反映されていたこと。A を復元するために公開鍵の線形係数だけを取り出して 50×50 行列を作り、その逆行列を使って変換を「解除」することで、ドミノ倒し式の順次解法が可能になった。
