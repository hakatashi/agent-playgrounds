#!/usr/bin/env python3
"""
CHISE IDS データベースを再帰的に展開し、
部品として「氵」を2回以上含む漢字を全て検索する。
"""

import glob
import sys

# IDS演算子 (⿰-⿻, U+2FF0-U+2FFB)
IDS_OPS = set(chr(c) for c in range(0x2FF0, 0x2FFC))

TARGET = '氵'

def build_ids_map():
    """全IDS-*.txtから文字→IDS辞書を構築する"""
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

def count_target_recursive(char, ids_map, visiting=None):
    """
    charを再帰的に展開してTARGET文字の出現回数を返す。
    循環参照を避けるためvisitingセットで追跡する。
    """
    if visiting is None:
        visiting = set()

    if char == TARGET:
        return 1

    if char in visiting:
        # 循環参照: 0として扱う
        return 0

    ids = ids_map.get(char)
    if ids is None or ids == char:
        # プリミティブ文字 (分解不可)
        return 0

    visiting = visiting | {char}

    total = 0
    for c in ids:
        if c in IDS_OPS:
            continue
        if c == char:
            continue
        total += count_target_recursive(c, ids_map, visiting)
    return total

def main():
    print(f'IDS-*.txt を読み込み中...', file=sys.stderr)
    ids_map = build_ids_map()
    print(f'合計 {len(ids_map)} 文字を読み込みました', file=sys.stderr)

    results = []
    for char, ids in ids_map.items():
        count = count_target_recursive(char, ids_map)
        if count >= 2:
            results.append((char, ids, count))

    # UCS基本漢字 (U+4E00-U+9FFF) を先頭に、その後コードポイント順
    def sort_key(item):
        char = item[0]
        cp = ord(char[0]) if len(char) == 1 else ord(char[0]) * 0x10000 + ord(char[1]) if len(char) == 2 else 0xFFFFFF
        if 0x4E00 <= cp <= 0x9FFF:
            return (0, cp)
        return (1, cp)

    results.sort(key=sort_key)

    print(f'\n「{TARGET}」が再帰的に2回以上現れる漢字: {len(results)} 文字\n')
    header = f"{'文字':<4} {'コードポイント':<12} {'直接IDS':<30} {'氵の数'}"
    print(header)
    print('-' * 65)
    for char, ids, count in results:
        if len(char) == 1:
            cp = f'U+{ord(char):04X}'
        else:
            cp = '+'.join(f'U+{ord(c):04X}' for c in char)
        print(f'{char:<4} {cp:<12} {ids:<30} {count}')

if __name__ == '__main__':
    main()
