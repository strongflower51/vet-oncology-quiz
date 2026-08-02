"""Create a non-duplicated mock examination from verified question-bank records."""
from __future__ import annotations

import argparse
import json
import random
from collections import Counter, defaultdict
from pathlib import Path


RATIO = {"basic": 0.40, "standard": 0.40, "hard": 0.20}


def read_records(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    if text.lstrip().startswith("["):
        records = json.loads(text)
        if not isinstance(records, list):
            raise ValueError("問題バンクJSONは配列である必要があります。")
        return records
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def target_counts(total: int) -> dict[str, int]:
    counts = {name: int(total * ratio) for name, ratio in RATIO.items()}
    for name in ("basic", "standard", "hard"):
        if sum(counts.values()) == total:
            break
        counts[name] += 1
    return counts


def choose(records: list[dict], count: int, seed: int | None) -> list[dict]:
    rng = random.Random(seed)
    records = [r for r in records if r.get("status") == "verified"]
    targets = target_counts(count)
    by_difficulty: dict[str, list[dict]] = defaultdict(list)
    for record in records:
        by_difficulty[record["difficulty"]].append(record)
    if any(len(by_difficulty[key]) < value for key, value in targets.items()):
        available = {key: len(by_difficulty[key]) for key in RATIO}
        raise ValueError(f"難易度別の検証済み問題が不足しています: 必要={targets}, 登録={available}")

    selected, used_keys = [], set()
    for difficulty, needed in targets.items():
        pool = by_difficulty[difficulty][:]
        rng.shuffle(pool)
        for record in pool:
            key = record.get("duplicate_key", record["id"])
            if key not in used_keys:
                selected.append(record)
                used_keys.add(key)
                if sum(r["difficulty"] == difficulty for r in selected) == needed:
                    break
        if sum(r["difficulty"] == difficulty for r in selected) != needed:
            raise ValueError(f"{difficulty}で重複を避けた抽出数を満たせません。")
    rng.shuffle(selected)
    return selected


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("count", type=int, choices=(30, 50, 100))
    parser.add_argument("--bank", type=Path, default=Path("questions.json"))
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--seed", type=int)
    args = parser.parse_args()
    selected = choose(read_records(args.bank), args.count, args.seed)
    args.output.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in selected) + "\n", encoding="utf-8")
    print(Counter(r["difficulty"] for r in selected))


if __name__ == "__main__":
    main()
