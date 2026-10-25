# atcoder-include-perf

Investigation of an AtCoder oddity: two submissions to
[ARC233 B](https://atcoder.jp/contests/arc233/tasks/arc233_b) that differ only in their includes
showed a consistent ~13% runtime difference.

| Submission | Includes | Max time | Sum over 99 cases |
| --- | --- | --- | --- |
| [A 80393940](https://atcoder.jp/contests/arc233/submissions/80393940) | `#include <bits/stdc++.h>` | 296 ms | 16731 ms |
| [B 80393864](https://atcoder.jp/contests/arc233/submissions/80393864) | `<iostream>`, `<vector>`, `<ranges>` | 334 ms | 18934 ms |

B was slower in all 99 test cases, with a B/A ratio between 1.107 and 1.157 (median 1.131).

## Findings

1. Built with GCC 15.2.0 (the same compiler as AtCoder's "C++23 (GCC 15.2.0)") and AtCoder's
   compile flags (`-O2 -march=native -fmodules -ftrivial-auto-var-init=zero -fopenmp -pthread
   -Wl,--as-needed ...`), and with the source file named `Main.cpp` as on the judge, **the two
   executables are byte-for-byte identical** (same SHA-256). The result is the same for
   `-march=native` (Zen 3), `x86-64-v3` and `znver4`, and also with `-flto=auto`, which AtCoder
   used before June 2026.
2. When the file names differ, the only differences are in `.symtab`/`.strtab` (the source file
   name). `.text` is identical.
3. Running both binaries alternately on the same local machine gives the same time
   (about 135 ms each on a Ryzen 7 5700X for a case with floor(N/m) = 10^6).

The includes don't change the generated program at all. The headers only declare templates
and inline functions. The code that ends up in the binary is just what `main` instantiates, and
that's the same in both versions. The extra declarations from `<bits/stdc++.h>` affect
compile time, not the output.

My first conclusion was that the gap came from judge-machine variance. **The resubmission test
below refutes that**: on AtCoder the difference is real and tied to the source code, so the
judge build must differ from this local reproduction in some way that hasn't been found yet.

## Resubmission test

The author resubmitted both sources several times after 00:32 JST. Sources were identified by
code length (A = 1245 B, B = 1278 B). The values are the max time over all test cases, taken from
the submission list. Run `python3 stats_test.py`.

| | n | Times (ms) | Median |
| --- | --- | --- | --- |
| A | 6 | 296, 296, 296, 302, 303, 323 | 299 |
| B | 6 | 302, 333, 334, 344, 346, 350 | 339 |

- Mann–Whitney U = 33.5 / 36, exact two-sided p = 0.011
- Permutation test on the mean difference (32.2 ms): exact two-sided p = 0.0087
- Welch t = 3.87 (df ≈ 8.2), p < 0.01

The submission times interleave (A at 00:51 and 00:57–58, B at 00:52–00:56), so time of day is
an unlikely confounder. All submissions, including earlier variants, fall into two modes:
about 300 ms or about 340 ms. Each source tends to stay in one mode (B: 5 of 6 slow; the 1290 B
variant was fast both times). That pattern looks like a code-layout/alignment effect, which is
only possible if the judge's executables for A and B differ.

## Open hypotheses (not verified)

- The judge's `-I<install_dir>/include` holds many third-party headers (Boost, LibTorch,
  OR-Tools, Abseil, ...). `<bits/stdc++.h>` pulls in `<execution>`, and libstdc++ sets
  `_GLIBCXX_USE_TBB_PAR_BACKEND` from `__has_include(<tbb/tbb.h>)`. If TBB headers are reachable,
  A would expand differently. LibTorch 2.8.0 doesn't ship TBB headers (checked); the other
  libraries weren't checked.
- Other differences between the real judge toolchain (a self-built GCC with `--disable-checking`
  and similar options, and extra link libraries) and the `gcc:15.2` Docker image.

To settle it, build in a faithful copy of the judge environment (AtCoder's install script),
or get the actual binaries or their `objdump` from the judge (e.g. via code test).

## Prerequisites

- Docker (uses the official `gcc:15.2` image)
- Python 3
- `git`, `taskset` (util-linux)

## How to run

```sh
git clone --depth 1 https://github.com/atcoder/ac-library.git   # ac-library headers
python3 fetch.py          # download both submissions into src/ and judge times into data/
./build_as_main.sh        # build both as Main.cpp with AtCoder's flags and compare the executables
mkdir -p inputs && python3 gen.py 1 > inputs/heavy1.txt   # worst-case-sized input
python3 bench.py build/A/a.out build/B/a.out inputs/heavy1.txt 30   # alternate timing runs
```

Set `MARCH=x86-64-v3` (or another target) for `build_as_main.sh` to try other `-march` values.
Binaries built for a target your CPU doesn't support will crash with SIGILL in `bench.py`.

The submitted sources belong to their author. They aren't stored in this repository;
`fetch.py` downloads them on demand into the git-ignored `src/` directory.
