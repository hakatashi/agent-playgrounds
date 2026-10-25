"""Run the two binaries alternately and compare wall-clock times."""
import statistics, subprocess, sys, time

bins = sys.argv[1:3]
inp = sys.argv[3]
rounds = int(sys.argv[4]) if len(sys.argv) > 4 else 30
data = open(inp, 'rb').read()
res = {b: [] for b in bins}
for r in range(rounds):
    for b in (bins if r % 2 == 0 else bins[::-1]):
        t = time.perf_counter()
        subprocess.run(['taskset', '-c', '2', b], input=data, stdout=subprocess.DEVNULL, check=True)
        res[b].append(time.perf_counter() - t)
for b in bins:
    v = res[b]
    print(f'{b:30s} median {statistics.median(v)*1000:8.2f} ms  min {min(v)*1000:8.2f} ms')
