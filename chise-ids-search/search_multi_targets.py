#!/usr/bin/env python3
"""
複数の部首について、再帰的に2回以上含む漢字を検索する
"""

import glob

IDS_OPS = set(chr(c) for c in range(0x2FF0, 0x2FFC))

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

def count_target(char, target, ids_map, visiting=None):
    if visiting is None:
        visiting = set()
    if char == target:
        return 1
    if char in visiting:
        return 0
    ids = ids_map.get(char)
    if ids is None or ids == char:
        return 0
    visiting = visiting | {char}
    return sum(count_target(c, target, ids_map, visiting) for c in ids if c not in IDS_OPS and c != char)

def main():
    print('IDS map 構築中...', flush=True)
    ids_map = build_ids_map()
    print(f'{len(ids_map)} 文字を読み込みました\n', flush=True)

    # IDS内での実際の表記形式にマッピング
    targets = [
        ('⺮', '竹'),  # ⺮ は IDS 内では 竹 として表記
        ('彳', '彳'),
        ('宀', '宀'),
        ('艹', '艹'),
        ('訁', '言'),  # 訁 は IDS 内では 言 として表記
        ('雨', '雨'),
        ('忄', '忄'),
    ]

    for display, lookup in targets:
        results = [
            ch for ch, ids in ids_map.items()
            if len(ch) == 1 and count_target(ch, lookup, ids_map) >= 2
        ]
        results.sort(key=lambda c: ord(c))
        label = display if display == lookup else f'{display}（={lookup}）'
        print(f'「{label}」({len(results)}文字): {" ".join(results)}')

if __name__ == '__main__':
    main()
