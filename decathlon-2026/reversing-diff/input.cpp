#include <iostream>
#include <vector>
#include <ranges>

int main() {
    std::cout << "Enter limit: ";
    int n;
    std::cin >> n;

    if (n <= 0) return 1;

    auto collatz = [](this auto self, long long n) -> int {
        if (n <= 1) return 0;
        if (n % 2 == 0) return self(n / 2) + 1;
        else return self(3 * n + 1) + 1;
    };

    std::vector<int> vec;

    for (int i : std::views::iota(1, n + 1)) {
        vec.push_back(collatz(i));
    }

    for (auto [index, val] : vec | std::ranges::views::enumerate) {
        std::cout << (index + 1) << ":" << val << " ";
        int cnt = (int)(index + 1);
        if (cnt % 5 == 0) std::cout << "\n";
    }

    return 0;
}
