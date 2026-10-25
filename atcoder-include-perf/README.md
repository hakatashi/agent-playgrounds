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

## Code-test diagnostics (`codetest/`)

`codetest/diag.cpp` is appended unchanged to both submissions. It adds no `#include`, so the
two sources still differ only in their include lines. A constructor that runs before `main`
reads `/proc/self/exe` with raw syscalls and writes these to stderr:

- the compiler version, `__has_include(<tbb/tbb.h>)`, and the related libstdc++ macros
- an FNV-1a hash of the whole executable and of each ELF section
- address, size and hash of every function symbol
- `/proc/self/maps`, which shows the shared libraries actually loaded
- the whole executable in base64, so it can be disassembled locally

```sh
./codetest/make.sh    # writes codetest/out/{a_bits,b_split}.cpp and builds them locally as a check
# run both on AtCoder's code test (C++23 GCC 15.2.0), save stderr, then:
python3 codetest/decode.py stderr_A.txt A.out
python3 codetest/decode.py stderr_B.txt B.out
cmp A.out B.out; objdump -d --no-show-raw-insn A.out > A.s   # etc.
```

The appended code changes the binary layout, so the timings of these variants aren't
comparable with the original submissions. Time the unmodified sources separately.

### Result (code test, 2026-10-26)

- **The judge-built executables for A and B are byte-for-byte identical** (21616 bytes,
  SHA-256 `11fc4000…90eb`). `__has_include(<tbb/tbb.h>)` is false, so the TBB hypothesis is out.
- The only loaded libraries are libstdc++/libgcc_s from `/opt/atcoder/gcc/lib64`, plus libm,
  libc and ld.so.
- `-march=native` on the judge produced the same user code as `-march=sapphirerapids`
  (also icelake/tigerlake/emeraldrapids, which generate the same code here): an Intel CPU
  with AVX-512. The only differences from a local build are in glibc's startup files (`endbr64`).

The resubmission gap therefore doesn't come from the generated code. It must come from
something in the execution environment that correlates with the submitted source.

## Runtime diagnostics (`codetest/runtime.cpp`)

The next hypothesis is that the environment differs at run time. For example, the compile step
just before the run (`<bits/stdc++.h>` takes much longer to compile and uses much more memory)
could leave the machine in a different state: free memory available for transparent huge pages,
CPU frequency, and so on. `runtime.cpp` is appended identically to both sources. With no
`#include` added, it prints the following at exit:

- wall-clock time from the constructor to the destructor, and CPU time
- minor page faults (a few thousand without huge pages for this program, far fewer with them)
- THP counters from `/proc/vmstat`, `/proc/meminfo`, and the THP sysfs settings
- the CPU model

```sh
./codetest/make_runtime.sh   # writes codetest/out/rt_{a_bits,b_split}.cpp
```

Run each variant several times, alternating, on the code test with the heavy input.

### Result (code test, 5 runs each, alternating)

`python3 codetest/analyze_runtime.py`:

| run | VM fingerprint\* | cpu MHz | wall ms |
| --- | --- | --- | --- |
| B_4 | 14092/8114/217 | 3197 | 193.5 |
| A_2 | 15963/8331/17 | 3223 | 195.5 |
| B_0 | 15963/8331/17 | 3258 | 195.2 |
| B_2 | 17083/9083/74 | 3317 | 182.5 |
| B_3 | 17688/6250/203 | 3500 | 183.1 |
| A_0 | 18871/6621/66 | 3797 | 169.4 |
| A_4 | 18871/6621/66 | 3800 | 168.9 |
| B_1 | 18871/6621/66 | 3800 | 168.0 |
| A_1 | 24430/13292/11 | 3800 | 169.0 |
| A_3 | 6127/3649/11 | 3797 | 166.3 |

\* `thp_fault_alloc/thp_fault_fallback/thp_collapse_alloc` from `/proc/vmstat`. These counters
cover the whole VM and didn't change during any run, so equal values mean the same judge VM.
MemTotal agrees within each group.

- The CPU is an Intel Xeon Platinum 8488C (Sapphire Rapids, AWS 7th-gen instances), in VMs
  with 3.9 GB of RAM.
- **Huge pages are not involved**: AnonHugePages is 0 and minflt is 1958–1959 in every run.
- **Run time is set by the CPU clock of the VM a run lands on.** Pearson r(MHz, wall) = −0.97,
  and wall × MHz is roughly constant. Fast runs see ~3.8 GHz (max turbo), slow runs
  ~3.2–3.3 GHz (all-core turbo range). 3.8 / 3.25 ≈ 1.17, which matches the ~13–15% gap
  between the ~300 ms and ~340 ms modes of the real submissions.
- **On the same VM, A and B are equally fast**: VM 18871 gave A_0 169.4, A_4 168.9 and B_1 168.0 ms;
  VM 15963 gave A_2 195.5 and B_0 195.2 ms.

The includes don't make the program slower. A run's speed is set by the turbo frequency the
judge VM gets at that moment, which most likely depends on how busy the physical host is.
In the code test, A again landed on fast VMs more often (4/5 vs 1/5, hypergeometric two-sided
p ≈ 0.21, not significant on its own). Whether the submission pipeline really routes sources
to VMs differently (e.g. through compile duration) is still open.

Locally (Ryzen 7 5700X), `python3 thp_bench.py build/A/a.out inputs/heavy1.txt` compares runs with
`GLIBC_TUNABLES=glibc.malloc.hugetlb=1`. Huge pages halve the minor faults (2095 → 1075) but change
the time by only ~1%, so on Zen 3 huge pages alone don't explain a 13% gap.

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
