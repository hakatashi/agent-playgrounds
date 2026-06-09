import json
import urllib.parse
import urllib.request


def get_category_intersection(cat1: str = "Category:2025", cat2: str = "Category:Implemented") -> list[str]:
    base_url = "https://esolangs.org/w/api.php"
    results = []

    params: dict[str, str] = {
        "action": "query",
        "generator": "categorymembers",
        "gcmtitle": cat1,
        "gcmlimit": "500",
        "prop": "categories",
        "clcategories": cat2,
        "cllimit": "500",
        "format": "json",
        "gcmnamespace": "0",
    }

    while True:
        query = "&".join(f"{k}={urllib.parse.quote(str(v))}" for k, v in params.items())
        url = f"{base_url}?{query}"

        with urllib.request.urlopen(url) as resp:
            data = json.loads(resp.read())

        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            if "categories" in page:
                results.append(page["title"])

        if "continue" not in data:
            break

        cont = data["continue"]
        del cont["continue"]
        params.update(cont)

    return sorted(set(results))


if __name__ == "__main__":
    import pathlib

    pages = get_category_intersection()
    lines = [f"https://esolangs.org/wiki/{urllib.parse.quote(p, safe=':/,')}" for p in pages]

    output_path = pathlib.Path(__file__).parent / "result.txt"
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"合計: {len(pages)} ページ → {output_path}")
    for line in lines:
        print(line)
