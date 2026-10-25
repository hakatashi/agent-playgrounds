"""Summarise codetest/out/stderr_rt_*.txt: machine fingerprint, CPU MHz, wall time, page faults."""
import glob, os, re, statistics

rows = []
for path in sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'stderr_rt_*.txt'))):
    s = open(path).read()
    g = lambda pat: re.search(pat, s).group(1)
    # vmstat THP counters are host(VM)-wide and did not move during runs, so they identify the judge VM
    vm = '/'.join(g(rf'{k} (\d+)') for k in ('thp_fault_alloc', 'thp_fault_fallback', 'thp_collapse_alloc'))
    rows.append(dict(run=os.path.basename(path)[10:-4], vm=vm, mem=g(r'MemTotal:\s+(\d+)'),
                     mhz=float(g(r'cpu MHz\s+:\s+([\d.]+)')), wall=int(g(r'wall_us: (\d+)')) / 1000,
                     minflt=int(g(r'minflt: (\d+)')), huge=g(r'AnonHugePages:\s+(\d+)')))

print(f"{'run':5} {'VM fingerprint':18} {'MemTotal':>9} {'MHz':>7} {'wall ms':>8} {'minflt':>6} {'AnonHuge':>8}")
for r in sorted(rows, key=lambda r: (r['vm'], r['run'])):
    print(f"{r['run']:5} {r['vm']:18} {r['mem']:>9} {r['mhz']:7.0f} {r['wall']:8.1f} {r['minflt']:6} {r['huge']:>8}")

x = [r['mhz'] for r in rows]
y = [r['wall'] for r in rows]
print(f"\nPearson r(MHz, wall) = {statistics.correlation(x, y):.3f}")
print('wall x MHz (should be ~constant if speed is set by clock):',
      ', '.join(f"{r['run']}={r['wall'] * r['mhz'] / 1000:.0f}" for r in rows))
