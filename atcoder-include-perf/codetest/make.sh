#!/bin/sh
# Create the code-test sources (original submission + identical diagnostics block),
# then build them locally with AtCoder's flags as a sanity check.
set -e
cd "$(dirname "$0")"
mkdir -p out
for s in a_bits b_split; do
  cat ../src/$s.cpp diag.cpp > out/$s.cpp
done
FLAGS="-DATCODER -DNOMINMAX -DONLINE_JUDGE -I/w/ac-library -O2 -Wall -Wextra \
-fconstexpr-depth=1024 -fconstexpr-loop-limit=524288 -fconstexpr-ops-limit=2097152 \
-fmodules -ftrivial-auto-var-init=zero -march=native -pthread -std=gnu++23 \
-Wl,--as-needed -fopenmp -lstdc++exp -lgmpxx -lgmp"
for s in a_bits b_split; do
  mkdir -p out/build_$s
  cp out/$s.cpp out/build_$s/Main.cpp
  docker run --rm -u "$(id -u):$(id -g)" -v "$PWD/..:/w" -w /w/codetest/out/build_$s gcc:15.2 \
    sh -c "g++ ./Main.cpp -o a.out $FLAGS"
done
ls -l out/*.cpp
