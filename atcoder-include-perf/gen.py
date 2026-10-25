"""Generate one worst-case-sized input for ARC233 B: a single case with floor(N/m) = 10^6."""
import random, sys

random.seed(int(sys.argv[1]) if len(sys.argv) > 1 else 1)
m = random.randint(10**11, 10**12)
N = m * 10**6 + random.randint(0, m - 1)
n = random.randint(1, m - 1)
print(1)
print(N, n, m)
