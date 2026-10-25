"""Compare run time of one binary with and without huge pages for malloc'd memory.
GLIBC_TUNABLES=glibc.malloc.hugetlb=1 makes glibc call madvise(MADV_HUGEPAGE) on its mmap'd
chunks, which emulates a host whose THP mode is "always" (when the setting is "madvise")."""
import os, statistics, subprocess, sys, time

binary, inp, rounds = sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 20
data = open(inp, 'rb').read()


def run(huge):
    env = dict(os.environ)
    env.pop('GLIBC_TUNABLES', None)
    if huge:
        env['GLIBC_TUNABLES'] = 'glibc.malloc.hugetlb=1'
    t = time.perf_counter()
    p = subprocess.run(['taskset', '-c', '2', '/usr/bin/time', '-f', '%R', binary], input=data, env=env,
                       stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True)
    return time.perf_counter() - t, int(p.stderr.split()[-1])


res = {False: [], True: []}
for r in range(rounds):
    for h in ((False, True) if r % 2 == 0 else (True, False)):
        res[h].append(run(h))
for h, v in res.items():
    print(f'huge pages {"on " if h else "off"}: median {statistics.median(x for x, _ in v) * 1000:7.1f} ms, '
          f'minor faults {statistics.median(f for _, f in v):.0f}')
