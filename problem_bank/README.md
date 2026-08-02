# 問題バンク

`questions.json` に1問ずつ配列要素として登録する。医学的な記載はすべて『腫瘍学テキスト第二版』の根拠ページに限定する。旧形式の `questions.jsonl` は移行確認用に保持し、以後の正本は `questions.json` とする。

## 必須項目

```json
{
  "id": "VO-0001",
  "format": "single_best_answer",
  "domain": ["診断学総論"],
  "difficulty": "basic",
  "importance": "high",
  "keywords": ["TNM", "ステージング"],
  "duplicate_key": "tnm-purpose",
  "question": "問題文",
  "choices": [{"label": "A", "text": "選択肢"}],
  "correct_answers": ["A"],
  "rationale": "正答の理由",
  "choice_rationales": {"A": "理由"},
  "sources": [{"chapter": "第1章 診断学総論", "printed_page": 0, "pdf_page": 0, "note": "図表・本文"}],
  "related_ids": [],
  "status": "verified"
}
```

`status` は、原本画像まで照合済みの `verified` のみを模擬試験の対象とする。`draft` は抽出しない。

## 模擬試験

`build_mock_exam.py` は、問題数を受け取り、基本40%、標準40%、難問20%を目標として、同一 `duplicate_key` の出題を避けながら `verified` 問題を抽出する。問題数に対して対象問題が不足する場合は停止する。
