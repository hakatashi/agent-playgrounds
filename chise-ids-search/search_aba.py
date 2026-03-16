#!/usr/bin/env python3
"""
「ABA」型（左右同一パーツの3横並び）漢字を検索する

対象パターン:
  1. ⿲ A B A  (直接の3分割で左=右)
  2. ⿴ X B   (X = ⿰ A A の形、外側が同一文字2つ)
"""

import glob

# IDS演算子の引数の数
IDS_OPS_2 = set(chr(c) for c in [0x2FF0, 0x2FF1, 0x2FF4, 0x2FF5, 0x2FF6, 0x2FF7, 0x2FF8, 0x2FF9, 0x2FFA, 0x2FFB])
IDS_OPS_3 = set(chr(c) for c in [0x2FF2, 0x2FF3])
IDS_OPS   = IDS_OPS_2 | IDS_OPS_3

def parse_ids(s, pos=0):
    """IDS文字列をパースし (expr, next_pos) を返す。
    expr は文字列（単一文字またはエンティティ参照）またはタプル (op, ...)。
    """
    if pos >= len(s):
        raise ValueError(f'Unexpected end at pos {pos} in "{s}"')

    ch = s[pos]

    # エンティティ参照 &...;
    if ch == '&':
        end = s.index(';', pos)
        return s[pos:end+1], end+1

    cp = ord(ch)

    if cp in range(0x2FF0, 0x2FFC):
        if ch in IDS_OPS_3:
            a, pos = parse_ids(s, pos+1)
            b, pos = parse_ids(s, pos)
            c, pos = parse_ids(s, pos)
            return (ch, a, b, c), pos
        else:
            a, pos = parse_ids(s, pos+1)
            b, pos = parse_ids(s, pos)
            return (ch, a, b), pos

    return ch, pos+1

def resolve_expr(expr, ids_map):
    """単一文字の場合、IDS辞書を引いて展開済みexprを返す。それ以外はそのまま。"""
    if isinstance(expr, str) and len(expr) == 1 and expr in ids_map:
        ids_str = ids_map[expr]
        if ids_str != expr:
            try:
                resolved, _ = parse_ids(ids_str)
                return resolved
            except Exception:
                pass
    return expr

def is_aba(expr, ids_map):
    """ABA型かどうか判定し、(A, B) を返す。該当しなければ None。"""
    if not isinstance(expr, tuple):
        return None

    op = expr[0]

    # パターン1: ⿲ A B A
    if op == '⿲' and len(expr) == 4:
        a, b, c = expr[1], expr[2], expr[3]
        if a == c:
            return (a, b)

    # パターン2: ⿴ X B  (X = ⿰ A A、または X が ⿰ A A に展開される単一文字)
    if op == '⿴' and len(expr) == 3:
        outer_raw, inner = expr[1], expr[2]
        outer = resolve_expr(outer_raw, ids_map)
        if isinstance(outer, tuple) and outer[0] == '⿰' and len(outer) == 3:
            a1, a2 = outer[1], outer[2]
            if a1 == a2:
                return (a1, inner)

    return None

def expr_to_str(expr):
    """IDS式を文字列に戻す"""
    if isinstance(expr, str):
        return expr
    return ''.join(expr_to_str(e) for e in expr)

def build_ids_map():
    ids_map = {}
    for fname in sorted(glob.glob('ids-data/IDS-*.txt')):
        with open(fname, encoding='utf-8') as f:
            for line in f:
                if line.startswith(';;') or not line.strip():
                    continue
                parts = line.strip().split('\t')
                if len(parts) < 3:
                    continue
                char = parts[1]
                ids = parts[2].split('@apparent=')[0].strip()
                if char not in ids_map:
                    ids_map[char] = ids
    return ids_map

def main():
    print('IDS map 構築中...', flush=True)
    ids_map = build_ids_map()
    print(f'{len(ids_map)} 文字を読み込みました\n', flush=True)

    results = []
    errors = 0

    for char, ids_str in ids_map.items():
        if len(char) != 1:
            continue
        try:
            expr, _ = parse_ids(ids_str)
        except Exception:
            errors += 1
            continue

        match = is_aba(expr, ids_map)
        if match is not None:
            a_str = expr_to_str(match[0])
            b_str = expr_to_str(match[1])
            if a_str != b_str:  # 3つ全て同一のものを除外
                results.append((char, ids_str, a_str, b_str))

    results.sort(key=lambda x: ord(x[0]))

    print(f'ABA型漢字: {len(results)} 文字 (パースエラー: {errors})\n')
    print(f'{"文字":<4} {"U+":<8} {"IDS":<25} {"A (左=右)":<15} {"B (中央)"}')
    print('-' * 70)
    for char, ids_str, a_str, b_str in results:
        cp = f'{ord(char):04X}'
        print(f'{char:<4} {cp:<8} {ids_str:<25} {a_str:<15} {b_str}')

if __name__ == '__main__':
    main()
