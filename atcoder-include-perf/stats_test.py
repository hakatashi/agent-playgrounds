"""Test whether submission A (bits/stdc++.h, 1245 B) and B (split includes, 1278 B) differ in
judge execution time, using MMNMM's resubmissions to ARC233 B (max time over all test cases).
Data transcribed from the AtCoder submission list; sources were identified by code length."""
import itertools, math, statistics

# (submit time JST 2026-10-26, code length, max execution time ms)
SUBMISSIONS = [
    ('00:13:00', 1402, 351), ('00:15:01', 1290, 297), ('00:18:06', 1327, 303),
    ('00:21:16', 1371, 341), ('00:25:54', 1388, 352), ('00:28:33', 1278, 334),
    ('00:29:43', 1290, 296), ('00:31:02', 1323, 344), ('00:32:05', 1245, 296),
    ('00:33:20', 1245, 296), ('00:51:01', 1245, 323), ('00:51:30', 1245, 303),
    ('00:52:29', 1278, 344), ('00:53:17', 1278, 350), ('00:54:03', 1278, 302),
    ('00:54:55', 1278, 346), ('00:56:15', 1278, 333), ('00:57:14', 1245, 296),
    ('00:58:25', 1245, 302),
]
A = [t for _, l, t in SUBMISSIONS if l == 1245]
B = [t for _, l, t in SUBMISSIONS if l == 1278]


def mann_whitney_u(x, y):
    """U statistic for x < y (ties count 0.5)."""
    return sum(1.0 if a < b else 0.5 if a == b else 0.0 for a in x for b in y)


def exact_perm_pvalue(x, y, stat):
    """Two-sided exact permutation test over all splits of the pooled sample."""
    pooled, n = x + y, len(x)
    obs = stat(x, y)
    center = statistics.mean(stat([pooled[i] for i in c], [pooled[i] for i in range(len(pooled)) if i not in c])
                             for c in itertools.combinations(range(len(pooled)), n))
    hits = total = 0
    for c in itertools.combinations(range(len(pooled)), n):
        xs = [pooled[i] for i in c]
        ys = [pooled[i] for i in range(len(pooled)) if i not in c]
        total += 1
        hits += abs(stat(xs, ys) - center) >= abs(obs - center) - 1e-9
    return obs, hits / total, total


def welch_t(x, y):
    mx, my = statistics.mean(x), statistics.mean(y)
    vx, vy = statistics.variance(x), statistics.variance(y)
    t = (my - mx) / math.sqrt(vx / len(x) + vy / len(y))
    df = (vx / len(x) + vy / len(y)) ** 2 / ((vx / len(x)) ** 2 / (len(x) - 1) + (vy / len(y)) ** 2 / (len(y) - 1))
    return t, df


print(f'A (1245 B, bits/stdc++.h): n={len(A)} {sorted(A)} mean {statistics.mean(A):.1f} median {statistics.median(A)}')
print(f'B (1278 B, split includes): n={len(B)} {sorted(B)} mean {statistics.mean(B):.1f} median {statistics.median(B)}')
u, p, n = exact_perm_pvalue(A, B, mann_whitney_u)
print(f'Mann-Whitney U (A<B pairs) = {u} / {len(A) * len(B)}, exact two-sided p = {p:.4f} ({n} splits)')
d, p, n = exact_perm_pvalue(A, B, lambda x, y: statistics.mean(y) - statistics.mean(x))
print(f'Permutation test on mean difference: {d:.1f} ms, exact two-sided p = {p:.4f}')
t, df = welch_t(A, B)
print(f'Welch t = {t:.2f}, df = {df:.1f} (two-sided p < 0.01 if |t| > {3.25 if df < 10 else 3.17})')

# Bimodality: every submission is either ~300 ms ("fast") or ~340 ms ("slow")
print('\nAll submissions by source (code length):')
for l in sorted({l for _, l, _ in SUBMISSIONS}):
    ts = [(s, t) for s, ll, t in SUBMISSIONS if ll == l]
    print(f'  {l} B: ' + ', '.join(f'{t} ms @{s}' for s, t in ts))
