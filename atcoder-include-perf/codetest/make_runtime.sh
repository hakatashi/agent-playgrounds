#!/bin/sh
# Create the runtime-measurement code-test sources (original submission + identical runtime.cpp)
# and build them locally with AtCoder's flags as a sanity check.
set -e
cd "$(dirname "$0")"
mkdir -p out
FLAGS="-DATCODER -DNOMINMAX -DONLINE_JUDGE -I/w/ac-library -O2 -Wall -Wextra \
-fconstexpr-depth=1024 -fconstexpr-loop-limit=524288 -fconstexpr-ops-limit=2097152 \
-fmodules -ftrivial-auto-var-init=zero -march=native -pthread -std=gnu++23 \
-Wl,--as-needed -fopenmp -lstdc++exp -lgmpxx -lgmp"
for s in a_bits b_split; do
  cat ../src/$s.cpp runtime.cpp > out/rt_$s.cpp
  mkdir -p out/build_rt_$s
  cp out/rt_$s.cpp out/build_rt_$s/Main.cpp
  docker run --rm -u "$(id -u):$(id -g)" -v "$PWD/..:/w" -w /w/codetest/out/build_rt_$s gcc:15.2 \
    sh -c "g++ ./Main.cpp -o a.out $FLAGS"
done
cmp out/build_rt_a_bits/a.out out/build_rt_b_split/a.out && echo "local builds identical"
ls -l out/rt_*.cpp
