
// ===== Runtime diagnostics appended identically to both submissions (see atcoder-include-perf/README.md) =====
// Prints to stderr at exit: wall/CPU time, minor page faults, THP settings and counters, CPU model.
// No #include is used on purpose; system calls are issued with inline asm.
namespace atcoder_include_perf_rt {

static long sys(long n, long a = 0, long b = 0, long c = 0) {
    long ret;
    asm volatile("syscall" : "=a"(ret) : "a"(n), "D"(a), "S"(b), "d"(c) : "rcx", "r11", "memory");
    return ret;
}

static char buf[1 << 16];
static char out[1 << 14];
static unsigned long olen;

static void puts_(const char* s) { while (*s && olen < sizeof out) out[olen++] = *s++; }
static void dec(unsigned long v) {
    char t[24];
    int n = 0;
    do t[n++] = static_cast<char>('0' + v % 10); while (v /= 10);
    while (n && olen < sizeof out) out[olen++] = t[--n];
}

static long read_file(const char* path) {
    long fd = sys(2, reinterpret_cast<long>(path), 0);
    if (fd < 0) return 0;
    long len = 0;
    for (long r; len < static_cast<long>(sizeof buf) - 1 && (r = sys(0, fd, reinterpret_cast<long>(buf + len), static_cast<long>(sizeof buf) - 1 - len)) > 0;)
        len += r;
    sys(3, fd);
    buf[len] = 0;
    return len;
}

static bool starts(const char* s, const char* p) {
    while (*p) if (*s++ != *p++) return false;
    return true;
}
// Print the lines of a file that start with one of the given prefixes.
static void grep(const char* path, const char* const* prefixes, int n, int max_lines = 1 << 30) {
    long len = read_file(path);
    if (!len) { puts_(path); puts_(": unreadable\n"); return; }
    int printed = 0;
    for (char* l = buf; *l && printed < max_lines;) {
        char* e = l;
        while (*e && *e != '\n') ++e;
        for (int i = 0; i < n; ++i)
            if (starts(l, prefixes[i])) {
                puts_(path); puts_(": ");
                for (char* c = l; c < e && olen < sizeof out; ++c) out[olen++] = *c;
                puts_("\n");
                ++printed;
                break;
            }
        l = *e ? e + 1 : e;
    }
}
static void cat(const char* path) {
    if (!read_file(path)) { puts_(path); puts_(": unreadable\n"); return; }
    puts_(path); puts_(": "); puts_(buf);
}

// minflt, majflt, utime, stime from /proc/self/stat (fields 10, 12, 14, 15)
struct Stat { unsigned long minflt, majflt, utime, stime; };
static Stat self_stat() {
    Stat s{};
    read_file("/proc/self/stat");
    char* p = buf;
    while (*p && *p != ')') ++p;  // skip "pid (comm)"
    unsigned long f[16]{};
    int field = 2;
    for (; *p && field < 15; ++p)
        if (*p == ' ') {
            ++field;
            unsigned long v = 0;
            for (char* q = p + 1; *q >= '0' && *q <= '9'; ++q) v = v * 10 + static_cast<unsigned long>(*q - '0');
            f[field] = v;
        }
    s.minflt = f[10]; s.majflt = f[12]; s.utime = f[14]; s.stime = f[15];
    return s;
}
static unsigned long now_ns() {
    long ts[2];
    sys(228, 1, reinterpret_cast<long>(ts));  // clock_gettime(CLOCK_MONOTONIC)
    return static_cast<unsigned long>(ts[0]) * 1000000000ul + static_cast<unsigned long>(ts[1]);
}

static unsigned long t0;
static Stat s0;
static const char* const VMSTAT[] = {"thp_fault_alloc ", "thp_fault_fallback ", "thp_collapse_alloc "};

__attribute__((constructor, used)) static void start() {
    puts_("=====RT-BEGIN=====\n");
    grep("/proc/vmstat", VMSTAT, 3);
    const char* const mem[] = {"MemTotal", "MemFree", "MemAvailable", "AnonHugePages"};
    grep("/proc/meminfo", mem, 4);
    s0 = self_stat();
    t0 = now_ns();
}

__attribute__((destructor, used)) static void finish() {
    unsigned long t1 = now_ns();
    Stat s1 = self_stat();
    puts_("wall_us: "); dec((t1 - t0) / 1000);
    puts_("\nutime_ticks: "); dec(s1.utime - s0.utime);
    puts_("  stime_ticks: "); dec(s1.stime - s0.stime);
    puts_("\nminflt: "); dec(s1.minflt - s0.minflt);
    puts_("  majflt: "); dec(s1.majflt - s0.majflt);
    puts_("\n");
    grep("/proc/vmstat", VMSTAT, 3);
    cat("/sys/kernel/mm/transparent_hugepage/enabled");
    cat("/sys/kernel/mm/transparent_hugepage/defrag");
    const char* const cpu[] = {"model name", "cpu MHz"};
    grep("/proc/cpuinfo", cpu, 2, 2);
    puts_("=====RT-END=====\n");
    for (unsigned long done = 0; done < olen;) {
        long w = sys(1, 2, reinterpret_cast<long>(out + done), static_cast<long>(olen - done));
        if (w <= 0) break;
        done += static_cast<unsigned long>(w);
    }
}

}  // namespace atcoder_include_perf_rt
