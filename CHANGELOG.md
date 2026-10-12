# Changelog

## 1.14.0 — webvideo fork

Fork 自 `web-video-presentation` 1.13.0，skill 名改为 `webvideo`。

- 端口统一：SKILL.md / references/RECORDING.md 中残留的 `localhost:5173` 改为 `5174`，与 vite 配置、scaffold 和所有渲染脚本一致
- 去掉硬编码路径：
  - `scripts/snapshot-chapters.mjs` 的 Playwright 解析改为 `import` → `$WEBVIDEO_PLAYWRIGHT_DIR` → 本脚本所在目录 → `<cwd>/scripts`
  - `templates/scripts/synthesize-audio-indextts.sh` 默认音色目录改为 `~/.webvideo/voices`（`$INDEXTTS_VOICE_DIR` 可覆盖）
- 补全依赖声明：frontmatter `requires` 加 node >= 18 / npm / jq / chromium，新增 `optional`（mmx-cli、indextts）
- 新增 `install.sh`：装系统依赖（Homebrew / apt / dnf）、Playwright + Chromium、skill 软链、音色目录，可选 mmx-cli / indextts / 多项目工作区；支持 `--check` 只检查、`--cn` 国内镜像
- `llm-score.py` 默认日志目录改为 `~/.claude/skills/webvideo/logs`
