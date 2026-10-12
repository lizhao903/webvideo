#!/usr/bin/env python3
"""
llm-score.py — 用 MiniMax M2.7 给一个 web-video 项目打信息忠实度分。

对比 article.md ↔ script.md，输出：
- fidelity_score (0-100)：article 关键信息在 script 里的覆盖程度
- missing_points：哪些关键信息漏了 + 严重程度 + 原因
- key_points_covered / total：粗略点数统计
- verdict：excellent / good / needs_review / poor
- summary：一两句话总结

用法：
  llm-score.py <project_dir>                  # 评一个项目
  llm-score.py --all <projects_root>          # 批量评 projects_root 下所有项目
  llm-score.py --all <projects_root> --force  # 不读缓存，强制重评

产物：每个项目下 llm-score.json
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

LOG_LOCK = threading.Lock()
LOG_FILE = None  # 启动时设置

def log(msg: str, also_stderr: bool = True):
    """线程安全的日志：同时写文件 + stderr，立即 flush"""
    ts = time.strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    with LOG_LOCK:
        if also_stderr:
            print(line, file=sys.stderr, flush=True)
        if LOG_FILE:
            with open(LOG_FILE, "a", encoding="utf-8") as f:
                f.write(line + "\n")

MODEL = "MiniMax-M2.7"
MAX_TOKENS = 4096
TEMPERATURE = 0.2

SYSTEM_PROMPT = """你是视频脚本质量审查员。给定一篇技术文章（article）和它对应的口播脚本（script），评估脚本对文章信息的覆盖程度。

评估原则：
1. 只评判忠实度（article 的关键信息有没有进 script），不评判 script 写得好不好
2. 关键信息 = 公式 / 数字 / 案例 / 概念定义 / 核心机制 / 关键人物或论文 / 重要的对比或论证
3. 同义改写、口语化包装、加入比喻、HKRR 风格的第一人称叙事都不算遗漏（如 article "学习率" → script "炼丹温度"是 OK 的）
4. script 引入 article 没有的次要素材（比喻 / 引言 / 过渡）不算扣分
5. 严重程度判断：
   - high = 核心机制 / 关键公式 / 关键数字漏了，会导致观众理解不到位
   - medium = 重要的对比 / 典型案例漏了，影响内容深度但不致命
   - low = 边角细节，可以接受

**输出格式严格要求**（违反会导致解析失败，浪费一次调用）：
- 只输出一个 JSON 对象，不要 markdown 代码块包装，不要前后空白和说明文字
- **绝对不要使用 LaTeX 反斜杠**（如 \\mathbb / \\gamma / \\sum / \\frac），公式一律用纯字符描述
  - 例：写 "E[X] = sum(x * p(x))" 而不是 "$\\mathbb{E}[X] = \\sum x p(x)$"
  - 例：写 "Q*(s,a) = E[r + gamma * max Q*(s',a')]" 而不是 LaTeX 版本
- JSON 中的中英文 / 数字 / 标点都用普通字符，避免任何会破坏 JSON 转义的内容

JSON 结构：
{
  "fidelity_score": 0-100 的整数,
  "key_points_total": 你从 article 抽出的关键信息点总数（整数）,
  "key_points_covered": script 里至少提及一次的关键信息点数（整数）,
  "missing_points": [
    {"point": "缺失内容的简短描述", "severity": "high|medium|low", "reason": "为什么算关键信息"}
  ],
  "added_points": ["script 里有但 article 没有的素材（只列实质性的，不列比喻和过渡）"],
  "summary": "一两句话总结忠实度情况",
  "verdict": "excellent|good|needs_review|poor"
}"""


def read_text(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="ignore")
    except FileNotFoundError:
        return ""


def content_hash(article: str, script: str) -> str:
    h = hashlib.sha256()
    h.update(article.encode("utf-8"))
    h.update(b"\x00")
    h.update(script.encode("utf-8"))
    return h.hexdigest()[:16]


def _fix_unescaped_backslashes(s: str) -> str:
    r"""JSON 字符串里出现单反斜杠 + 非合法转义字符时，把反斜杠双写。
    合法 JSON 转义：\" \\ \/ \b \f \n \r \t \uXXXX"""
    return re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', s)


def extract_json(raw: str) -> dict:
    """从 LLM 输出中抽 JSON，容忍少量 markdown 包装、说明文字和未转义反斜杠"""
    raw = raw.strip()
    # 去掉常见的 markdown code block
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*\n?", "", raw)
        raw = re.sub(r"\n?```\s*$", "", raw)
    # 找到第一个 { 到最后一个 } 之间的内容
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"no JSON object found in: {raw[:200]}")
    candidate = raw[start:end + 1]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        # 容错：把未转义的反斜杠双写后再试
        return json.loads(_fix_unescaped_backslashes(candidate))


MMX_TIMEOUT = 600  # subprocess wall-clock 超时
MMX_RPC_TIMEOUT = 600  # mmx --timeout 透传给 HTTP 调用
MMX_RETRIES = 2


def call_mmx(article: str, script: str, project_slug: str) -> dict:
    """调用 mmx text chat（带 1 次重试）。返回解析后的 JSON dict。"""
    user_msg = (
        f"项目：{project_slug}\n\n"
        f"=== article.md ===\n{article}\n\n"
        f"=== script.md ===\n{script}\n"
    )

    # 用 messages-file 避免命令行参数过长
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tf:
        json.dump(messages, tf, ensure_ascii=False)
        msg_path = tf.name

    cmd = [
        "mmx", "text", "chat",
        "--messages-file", msg_path,
        "--model", MODEL,
        "--max-tokens", str(MAX_TOKENS),
        "--temperature", str(TEMPERATURE),
        "--timeout", str(MMX_RPC_TIMEOUT),
        "--output", "json",
        "--quiet",
        "--non-interactive",
        "--no-color",
    ]

    try:
        last_err = None
        for attempt in range(MMX_RETRIES + 1):
            try:
                proc = subprocess.run(cmd, capture_output=True, text=True, timeout=MMX_TIMEOUT)
                if proc.returncode != 0:
                    raise RuntimeError(f"mmx exit={proc.returncode}  stderr={proc.stderr[:300]}")
                break
            except subprocess.TimeoutExpired:
                last_err = f"timeout {MMX_TIMEOUT}s on attempt {attempt + 1}"
                log(f"  [retry] {project_slug}: {last_err}")
                continue
            except Exception as e:
                last_err = str(e)
                if attempt < MMX_RETRIES:
                    log(f"  [retry] {project_slug}: {last_err}")
                    continue
                raise
        else:
            raise RuntimeError(f"all retries failed: {last_err}")

        outer = proc.stdout.strip()
        call_mmx._last_raw = outer  # 失败时给 score_project 拿来存盘排查
        # mmx 的 JSON 输出格式: 直接是 {"content": "...", ...} 或 类似结构
        # 兼容两种：模型直接吐 JSON，或外层包了一层
        try:
            outer_obj = json.loads(outer)
        except json.JSONDecodeError:
            # mmx 可能直接吐了 raw content
            return extract_json(outer)

        # 尝试从常见字段抽 content
        if isinstance(outer_obj, dict):
            for k in ("content", "text", "message", "response"):
                if k in outer_obj and isinstance(outer_obj[k], str):
                    return extract_json(outer_obj[k])
            # 也可能 outer_obj 就是评分 JSON
            if "fidelity_score" in outer_obj:
                return outer_obj
        raise RuntimeError(f"unrecognized mmx output: {outer[:300]}")
    finally:
        os.unlink(msg_path)


def score_project(proj_dir: Path, force: bool = False) -> dict | None:
    """评一个项目。返回 result dict 或 None（跳过 / 失败）。"""
    article_p = proj_dir / "article.md"
    script_p = proj_dir / "script.md"
    out_p = proj_dir / "llm-score.json"

    if not article_p.exists() or not script_p.exists():
        log(f"  [skip] {proj_dir.name}: 缺 article 或 script")
        return None

    article = read_text(article_p)
    script = read_text(script_p)
    digest = content_hash(article, script)

    if not force and out_p.exists():
        try:
            cached = json.loads(out_p.read_text(encoding="utf-8"))
            if cached.get("_content_hash") == digest:
                log(f"  [cache] {proj_dir.name}: {cached.get('fidelity_score')}/100  verdict={cached.get('verdict')}")
                return cached
        except Exception:
            pass

    def normalize_keys(d: dict) -> dict:
        """容错：LLM 偶尔会把 key 拼错（如 fiduciality_score），统一映射回标准 key"""
        key_aliases = {
            "fiduciality_score": "fidelity_score",
            "faithfulness_score": "fidelity_score",
            "score": "fidelity_score",
        }
        for wrong, right in key_aliases.items():
            if wrong in d and right not in d:
                d[right] = d.pop(wrong)
        return d

    log(f"  [call ] {proj_dir.name}: article={len(article)}c  script={len(script)}c  → mmx ...")
    t0 = time.time()
    try:
        result = call_mmx(article, script, proj_dir.name)
        result = normalize_keys(result)
        if result.get("fidelity_score") is None:
            raise RuntimeError(f"missing fidelity_score in result keys: {list(result.keys())}")
    except Exception as e:
        # 保存最后一次的 raw output 以便排查
        err_p = proj_dir / "llm-score-error.txt"
        err_msg = f"# {time.strftime('%Y-%m-%dT%H:%M:%S')}\n# {e}\n"
        raw = getattr(call_mmx, "_last_raw", "")
        if raw:
            err_msg += f"\n--- raw mmx output ---\n{raw}\n"
        err_p.write_text(err_msg, encoding="utf-8")
        log(f"  [error] {proj_dir.name}: {e}  (raw saved to llm-score-error.txt)")
        return None
    dt = time.time() - t0

    result["_content_hash"] = digest
    result["_model"] = MODEL
    result["_elapsed_s"] = round(dt, 1)
    result["_scored_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    result["_project"] = proj_dir.name

    out_p.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    missing = result.get("missing_points", [])
    high = sum(1 for m in missing if m.get("severity") == "high")
    med = sum(1 for m in missing if m.get("severity") == "medium")
    low = sum(1 for m in missing if m.get("severity") == "low")
    log(
        f"  [done ] {proj_dir.name}: score={result.get('fidelity_score')}/100  "
        f"verdict={result.get('verdict')}  miss=H{high}/M{med}/L{low}  ({dt:.1f}s)"
    )
    return result


def main():
    global LOG_FILE
    ap = argparse.ArgumentParser(description=__doc__)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("project", nargs="?", help="单个项目目录路径")
    g.add_argument("--all", metavar="ROOT", help="批量评 ROOT 下所有子目录项目")
    ap.add_argument("--force", action="store_true", help="忽略缓存，强制重评")
    ap.add_argument("--limit", type=int, default=0, help="批量模式下只跑前 N 个")
    ap.add_argument("--parallel", type=int, default=1,
                    help="批量模式下的并发数（mmx 是 HTTP，I/O 密集，4-8 通常安全）")
    ap.add_argument("--log", metavar="PATH", default="",
                    help="日志文件路径。默认 ~/.claude/skills/webvideo/logs/llm-score-<YYYYMMDD>.log")
    args = ap.parse_args()

    # 配置日志
    if args.log:
        LOG_FILE = args.log
    else:
        log_dir = Path.home() / ".claude" / "skills" / "webvideo" / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        LOG_FILE = str(log_dir / f"llm-score-{time.strftime('%Y%m%d')}.log")

    log(f"==> llm-score start  log={LOG_FILE}")

    if args.project:
        result = score_project(Path(args.project), force=args.force)
        if result is None:
            sys.exit(1)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    root = Path(args.all)
    if not root.is_dir():
        log(f"not a directory: {root}")
        sys.exit(2)

    projects = sorted(p for p in root.iterdir() if p.is_dir() and not p.name.startswith("."))
    if args.limit:
        projects = projects[: args.limit]

    eta_serial = len(projects) * 18
    eta = eta_serial / max(1, args.parallel)
    log(f"[batch] {len(projects)} projects in {root}  parallel={args.parallel}  ETA≈{int(eta/60)}m{int(eta%60)}s")
    summary = {"ok": 0, "skip": 0, "error": 0}
    completed = [0]
    total = len(projects)

    def _work(p):
        r = score_project(p, force=args.force)
        completed[0] += 1
        log(f"  ── progress {completed[0]}/{total} ──")
        return p, r

    if args.parallel <= 1:
        for p in projects:
            _, r = _work(p)
            if r is None:
                summary["skip" if not (p / "article.md").exists() else "error"] += 1
            else:
                summary["ok"] += 1
    else:
        with ThreadPoolExecutor(max_workers=args.parallel) as ex:
            futures = [ex.submit(_work, p) for p in projects]
            for fu in as_completed(futures):
                p, r = fu.result()
                if r is None:
                    summary["skip" if not (p / "article.md").exists() else "error"] += 1
                else:
                    summary["ok"] += 1

    log(f"[batch done] {summary}")


if __name__ == "__main__":
    main()
