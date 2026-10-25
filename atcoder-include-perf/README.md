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

So the 13% gap must come from the judge, not the code. All test cases of a submission run in
the same judge environment, so if one submission lands on a slower machine or a busier time,
every case is slower by about the same factor. That fits the narrow 1.11–1.16 ratio across
all 99 cases. Resubmitting the same code several times should show this variance directly.

Caveat: the real judge also has `-I` paths for Boost, LibTorch, OR-Tools, etc. and links many
extra libraries, which the `gcc:15.2` image lacks. The `--as-needed` flag drops libraries that
aren't referenced, and none of those include paths contains the headers used here, so this
shouldn't affect the conclusion.

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
