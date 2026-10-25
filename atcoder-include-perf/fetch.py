"""Download the two AtCoder submissions (source + per-test-case times) into src/ and data/."""
import html, json, os, re, sys, time, urllib.request

SUBMISSIONS = {'a_bits': 80393940, 'b_split': 80393864}
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

os.chdir(os.path.dirname(os.path.abspath(__file__)))
os.makedirs('src', exist_ok=True)
os.makedirs('data', exist_ok=True)
times = {}
for name, sid in SUBMISSIONS.items():
    req = urllib.request.Request(f'https://atcoder.jp/contests/arc233/submissions/{sid}',
                                 headers={'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'ja'})
    page = urllib.request.urlopen(req).read().decode()
    code = html.unescape(re.search(r'<pre id="submission-code"[^>]*>(.*?)</pre>', page, re.S).group(1))
    open(f'src/{name}.cpp', 'w').write(code)
    times[name] = {n: int(t) for n, t in re.findall(
        r'<td class="text-center">([^<]*)</td>\s*<td class="text-center">\s*<span[^>]*>\w+</span>\s*</td>\s*'
        r'<td class="text-right">(\d+) ms</td>', page)}
    time.sleep(2)
json.dump(times, open('data/judge_times.json', 'w'), indent=1)

a, b = times['a_bits'], times['b_split']
ratios = sorted(b[n] / a[n] for n in a if a[n] >= 50)
print(f'test cases: {len(a)}, B slower in {sum(b[n] > a[n] for n in a)}, '
      f'total A={sum(a.values())} ms B={sum(b.values())} ms')
print(f'B/A ratio (cases >= 50 ms): min {ratios[0]:.3f} median {ratios[len(ratios)//2]:.3f} max {ratios[-1]:.3f}')
