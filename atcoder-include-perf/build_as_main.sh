#!/bin/sh
# Build each submission exactly as AtCoder does: file named Main.cpp, output a.out,
# then compare the two resulting executables byte by byte.
set -e
cd "$(dirname "$0")"
mkdir -p build/A build/B
cp src/a_bits.cpp build/A/Main.cpp
cp src/b_split.cpp build/B/Main.cpp
FLAGS="-DATCODER -DNOMINMAX -DONLINE_JUDGE -I/w/ac-library -O2 -Wall -Wextra \
-fconstexpr-depth=1024 -fconstexpr-loop-limit=524288 -fconstexpr-ops-limit=2097152 \
-fmodules -ftrivial-auto-var-init=zero -march=${MARCH:-native} -pthread -std=gnu++23 \
-Wl,--as-needed -fopenmp -lstdc++exp -lgmpxx -lgmp"
for d in A B; do
  docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/w" -w /w/build/$d gcc:15.2 \
    sh -c "g++ ./Main.cpp -o a.out $FLAGS 2>/dev/null"
done
sha256sum build/A/a.out build/B/a.out
cmp build/A/a.out build/B/a.out && echo "BYTE-IDENTICAL executables"
