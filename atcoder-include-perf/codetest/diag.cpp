
// ===== Diagnostics appended identically to both submissions (see atcoder-include-perf/README.md) =====
// Dumps information about the running executable to stderr before main() starts.
// No #include is used on purpose: adding headers would change what we are trying to compare.
// System calls are issued with inline asm, buffers come from mmap so .bss stays untouched.
namespace atcoder_include_perf_diag {

static long sys(long n, long a = 0, long b = 0, long c = 0, long d = 0, long e = 0, long f = 0) {
    long ret;
    register long r10 asm("r10") = d;
    register long r8 asm("r8") = e;
    register long r9 asm("r9") = f;
    asm volatile("syscall" : "=a"(ret) : "a"(n), "D"(a), "S"(b), "d"(c), "r"(r10), "r"(r8), "r"(r9)
                 : "rcx", "r11", "memory");
    return ret;
}

static unsigned char* alloc(unsigned long size) {
    // mmap(NULL, size, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0)
    return reinterpret_cast<unsigned char*>(sys(9, 0, static_cast<long>(size), 3, 0x22, -1, 0));
}

static char* out;
static unsigned long olen;
static const unsigned long OUT_CAP = 8ul << 20;

static void flush() {
    unsigned long done = 0;
    while (done < olen) {
        long w = sys(1, 2, reinterpret_cast<long>(out + done), static_cast<long>(olen - done));
        if (w <= 0) break;
        done += static_cast<unsigned long>(w);
    }
    olen = 0;
}
static void putc_(char c) {
    if (olen == OUT_CAP) flush();
    out[olen++] = c;
}
static void puts_(const char* s) { while (*s) putc_(*s++); }
static void putn(const char* s, unsigned long n) { for (unsigned long i = 0; i < n && s[i]; ++i) putc_(s[i]); }
static void hex(unsigned long v, int width = 16) {
    for (int i = width - 1; i >= 0; --i) putc_("0123456789abcdef"[(v >> (4 * i)) & 15]);
}
static void dec(unsigned long v) {
    char t[24];
    int n = 0;
    do t[n++] = static_cast<char>('0' + v % 10); while (v /= 10);
    while (n) putc_(t[--n]);
}
static unsigned long fnv(const unsigned char* p, unsigned long n) {
    unsigned long h = 1469598103934665603ul;
    for (unsigned long i = 0; i < n; ++i) h = (h ^ p[i]) * 1099511628211ul;
    return h;
}

static unsigned long read_file(const char* path, unsigned char* buf, unsigned long cap) {
    long fd = sys(2, reinterpret_cast<long>(path), 0);  // open(path, O_RDONLY)
    if (fd < 0) return 0;
    unsigned long len = 0;
    for (long r; len < cap && (r = sys(0, fd, reinterpret_cast<long>(buf + len), static_cast<long>(cap - len))) > 0;)
        len += static_cast<unsigned long>(r);
    sys(3, fd);
    return len;
}

template <class T> static T rd(const unsigned char* p) {
    T v;
    __builtin_memcpy(&v, p, sizeof(T));
    return v;
}

__attribute__((constructor, noinline, used)) static void run() {
    out = reinterpret_cast<char*>(alloc(OUT_CAP));
    const unsigned long CAP = 64ul << 20;
    unsigned char* bin = alloc(CAP);
    unsigned long size = read_file("/proc/self/exe", bin, CAP);

    puts_("=====DIAG-BEGIN=====\n");
#ifdef __VERSION__
    puts_("compiler: " __VERSION__ "\n");
#endif
#if __has_include(<tbb/tbb.h>)
    puts_("has_include(<tbb/tbb.h>): yes\n");
#else
    puts_("has_include(<tbb/tbb.h>): no\n");
#endif
#ifdef _GLIBCXX_USE_TBB_PAR_BACKEND
    puts_("_GLIBCXX_USE_TBB_PAR_BACKEND: defined\n");
#endif
#ifdef _PSTL_PAR_BACKEND_TBB
    puts_("_PSTL_PAR_BACKEND_TBB: defined\n");
#endif
    puts_("exe size: "); dec(size); puts_("  fnv1a64: "); hex(fnv(bin, size)); putc_('\n');

    if (size >= 64 && rd<unsigned>(bin) == 0x464c457fu) {
        unsigned long shoff = rd<unsigned long>(bin + 0x28);
        unsigned shentsize = rd<unsigned short>(bin + 0x3a), shnum = rd<unsigned short>(bin + 0x3c),
                 shstrndx = rd<unsigned short>(bin + 0x3e);
        auto sh = [&](unsigned i) { return bin + shoff + static_cast<unsigned long>(i) * shentsize; };
        if (shoff + static_cast<unsigned long>(shnum) * shentsize <= size && shstrndx < shnum) {
            const char* shstr = reinterpret_cast<const char*>(bin + rd<unsigned long>(sh(shstrndx) + 0x18));
            puts_("-- sections: name addr offset size fnv1a64\n");
            unsigned symtab = 0;
            for (unsigned i = 1; i < shnum; ++i) {
                unsigned type = rd<unsigned>(sh(i) + 4);
                unsigned long addr = rd<unsigned long>(sh(i) + 0x10), off = rd<unsigned long>(sh(i) + 0x18),
                              sz = rd<unsigned long>(sh(i) + 0x20);
                if (type == 2) symtab = i;
                puts_(shstr + rd<unsigned>(sh(i))); putc_(' '); hex(addr); putc_(' '); hex(off, 8); putc_(' ');
                hex(sz, 8); putc_(' ');
                if (type != 8 && off + sz <= size) hex(fnv(bin + off, sz)); else puts_("-");
                putc_('\n');
            }
            if (symtab) {
                // Map virtual addresses of executable sections back to file offsets to hash functions.
                unsigned long symoff = rd<unsigned long>(sh(symtab) + 0x18), symsz = rd<unsigned long>(sh(symtab) + 0x20);
                unsigned strndx = rd<unsigned>(sh(symtab) + 0x28);
                const char* str = reinterpret_cast<const char*>(bin + rd<unsigned long>(sh(strndx) + 0x18));
                puts_("-- functions: addr size fnv1a64 name\n");
                for (unsigned long p = symoff; p + 24 <= symoff + symsz; p += 24) {
                    unsigned char info = bin[p + 4];
                    unsigned long value = rd<unsigned long>(bin + p + 8), sz = rd<unsigned long>(bin + p + 16);
                    if ((info & 15) != 2 || value == 0 || sz == 0) continue;
                    unsigned long foff = 0;
                    for (unsigned i = 1; i < shnum; ++i) {
                        unsigned long a = rd<unsigned long>(sh(i) + 0x10), s = rd<unsigned long>(sh(i) + 0x20);
                        if (rd<unsigned>(sh(i) + 4) == 1 && a && a <= value && value + sz <= a + s)
                            foff = rd<unsigned long>(sh(i) + 0x18) + (value - a);
                    }
                    hex(value); putc_(' '); dec(sz); putc_(' ');
                    if (foff) hex(fnv(bin + foff, sz)); else puts_("-");
                    putc_(' '); putn(str + rd<unsigned>(bin + p), 160); putc_('\n');
                }
            }
        }
    }

    unsigned char* maps = alloc(1ul << 20);
    unsigned long mlen = read_file("/proc/self/maps", maps, (1ul << 20) - 1);
    puts_("-- /proc/self/maps\n");
    for (unsigned long i = 0; i < mlen; ++i) putc_(static_cast<char>(maps[i]));

    if (size <= (4ul << 20)) {
        puts_("-- base64 of /proc/self/exe\n");
        const char* tbl = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        unsigned long col = 0;
        for (unsigned long i = 0; i < size; i += 3) {
            unsigned long v = static_cast<unsigned long>(bin[i]) << 16;
            if (i + 1 < size) v |= static_cast<unsigned long>(bin[i + 1]) << 8;
            if (i + 2 < size) v |= bin[i + 2];
            putc_(tbl[(v >> 18) & 63]); putc_(tbl[(v >> 12) & 63]);
            putc_(i + 1 < size ? tbl[(v >> 6) & 63] : '=');
            putc_(i + 2 < size ? tbl[v & 63] : '=');
            if ((col += 4) == 76) { putc_('\n'); col = 0; }
        }
        if (col) putc_('\n');
    }
    puts_("=====DIAG-END=====\n");
    flush();
}

}  // namespace atcoder_include_perf_diag
