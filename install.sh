#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# install.sh — webvideo skill 运行环境安装器
#
# 做的事（按顺序，每步幂等，可重复跑）：
#   1. 系统依赖：node(>=18) / npm / ffmpeg / jq
#        macOS 用 Homebrew，Linux 用 apt-get / dnf
#   2. Playwright：在 skill 的 scripts/ 下 npm install，并下载 Chromium
#   3. 把 skill 软链到 ~/.claude/skills/webvideo（--no-link 跳过）
#   4. 建音色目录 ~/.webvideo/voices（--voices-from 可拷入已有 .voice.pt）
#   5. 可选：mmx-cli（MiniMax 云端 TTS）      --with-mmx
#   6. 可选：indextts（本机 IndexTTS-MLX）    --with-indextts --indextts-repo <dir>
#   7. 可选：初始化多项目工作区                --workspace <dir>
#
# 用法：
#   ./install.sh                       必装项 + 软链
#   ./install.sh --all                 再加 mmx-cli + indextts
#   ./install.sh --check               只检查，不安装任何东西
#   ./install.sh --cn                  npm / Playwright 走国内镜像
#   ./install.sh --help                全部选项
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_NAME="webvideo"
NODE_MIN_MAJOR=18

CHECK_ONLY=false
WITH_MMX=false
WITH_INDEXTTS=false
INDEXTTS_REPO="${INDEXTTS_REPO:-}"
VOICES_FROM=""
VOICE_DIR="${INDEXTTS_VOICE_DIR:-$HOME/.webvideo/voices}"
DO_LINK=true
SKILLS_DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
FORCE_LINK=false
WORKSPACE=""
USE_CN_MIRROR=false

usage() {
  cat <<EOF
用法: ./install.sh [选项]

  --check                只检查环境，不做任何安装
  --all                  等价于 --with-mmx --with-indextts
  --with-mmx             安装 mmx-cli（npm 全局包，MiniMax 云端 TTS）
  --with-indextts        配置本机 IndexTTS-MLX（需要 --indextts-repo 或环境变量 INDEXTTS_REPO）
  --indextts-repo <dir>  index-tts-mlx 仓库路径（已 clone、已下载模型权重）
  --voices-from <dir>    把 <dir>/*.voice.pt 拷进音色目录
  --voice-dir <dir>      音色目录（默认 \$INDEXTTS_VOICE_DIR 或 ~/.webvideo/voices）
  --workspace <dir>      在 <dir> 初始化多项目工作区（start/stop/render 脚本 + projects/）
  --skills-dir <dir>     skill 软链目标目录（默认 ~/.claude/skills）
  --no-link              不创建 skill 软链
  --force-link           目标位置已有别的 webvideo 时强制替换软链
  --cn                   npm registry 与 Playwright 浏览器下载走 npmmirror 镜像
  -h, --help             显示本帮助
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --check)          CHECK_ONLY=true ;;
    --all)            WITH_MMX=true; WITH_INDEXTTS=true ;;
    --with-mmx)       WITH_MMX=true ;;
    --with-indextts)  WITH_INDEXTTS=true ;;
    --indextts-repo)  INDEXTTS_REPO="$2"; shift ;;
    --voices-from)    VOICES_FROM="$2"; shift ;;
    --voice-dir)      VOICE_DIR="$2"; shift ;;
    --workspace)      WORKSPACE="$2"; shift ;;
    --skills-dir)     SKILLS_DIR="$2"; shift ;;
    --no-link)        DO_LINK=false ;;
    --force-link)     FORCE_LINK=true ;;
    --cn)             USE_CN_MIRROR=true ;;
    -h|--help)        usage; exit 0 ;;
    *) echo "未知参数: $1" >&2; usage >&2; exit 1 ;;
  esac
  shift
done

# ── 输出工具 ─────────────────────────────────────────────────────────
if [ -t 1 ]; then
  C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_DIM=$'\033[2m'; C_RST=$'\033[0m'
else
  C_OK=""; C_WARN=""; C_ERR=""; C_DIM=""; C_RST=""
fi
step() { printf '\n== %s\n' "$*"; }
ok()   { printf '  %s[ok]%s   %s\n' "$C_OK" "$C_RST" "$*"; }
warn() { printf '  %s[warn]%s %s\n' "$C_WARN" "$C_RST" "$*"; }
err()  { printf '  %s[fail]%s %s\n' "$C_ERR" "$C_RST" "$*"; }
info() { printf '  %s%s%s\n' "$C_DIM" "$*" "$C_RST"; }

SUMMARY=()
record() { SUMMARY+=("$1|$2|$3"); }   # 名称|状态|说明
has() { command -v "$1" >/dev/null 2>&1; }

OS="$(uname -s)"
PKG=""
if [ "$OS" = "Darwin" ]; then
  has brew && PKG="brew"
elif [ "$OS" = "Linux" ]; then
  if has apt-get; then PKG="apt"; elif has dnf; then PKG="dnf"; fi
fi

SUDO=""
if [ "$PKG" = "apt" ] || [ "$PKG" = "dnf" ]; then
  [ "$(id -u)" -ne 0 ] && SUDO="sudo"
fi
APT_UPDATED=false

# 安装系统包：pkg_install <brew 名> <apt 名> <dnf 名>
pkg_install() {
  local brew_name="$1" apt_name="$2" dnf_name="$3"
  case "$PKG" in
    brew) brew install "$brew_name" ;;
    apt)
      if [ "$APT_UPDATED" = false ]; then $SUDO apt-get update -y; APT_UPDATED=true; fi
      $SUDO apt-get install -y "$apt_name" ;;
    dnf) $SUDO dnf install -y "$dnf_name" ;;
    *) return 1 ;;
  esac
}

no_pkg_manager_hint() {
  if [ "$OS" = "Darwin" ]; then
    info "未检测到 Homebrew。先装 Homebrew：https://brew.sh"
    info '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  else
    info "未识别的包管理器，请手动安装后重跑本脚本。"
  fi
}

if [ "$USE_CN_MIRROR" = true ]; then
  export npm_config_registry="https://registry.npmmirror.com"
  export PLAYWRIGHT_DOWNLOAD_HOST="https://npmmirror.com/mirrors/playwright"
fi

echo "webvideo 环境安装"
echo "  skill 目录: $SKILL_DIR"
echo "  系统:       $OS${PKG:+ ($PKG)}"
[ "$CHECK_ONLY" = true ] && echo "  模式:       仅检查（--check）"
[ "$USE_CN_MIRROR" = true ] && echo "  镜像:       npmmirror"

# ── 1. 系统依赖 ──────────────────────────────────────────────────────
step "1/7 系统依赖"

node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }

ensure_node() {
  if has node && [ "$(node_major)" -ge "$NODE_MIN_MAJOR" ] && has npm; then
    ok "node $(node -v) / npm $(npm -v)"
    record node ok "$(node -v)"
    return
  fi
  if has node; then
    warn "node $(node -v) 低于要求的 v${NODE_MIN_MAJOR}（脚本依赖内置 fetch）"
  else
    warn "未找到 node"
  fi
  if [ "$CHECK_ONLY" = true ]; then record node missing "需要 node >= ${NODE_MIN_MAJOR}"; return; fi
  if [ -z "$PKG" ]; then no_pkg_manager_hint; record node missing "请手动安装"; return; fi
  info "安装 node ..."
  if [ "$PKG" = "apt" ]; then
    # 发行版自带的 node 往往太旧，走 NodeSource 的 LTS 源
    curl -fsSL https://deb.nodesource.com/setup_lts.x | $SUDO -E bash -
    $SUDO apt-get install -y nodejs
  else
    pkg_install node nodejs nodejs
  fi
  if has node && [ "$(node_major)" -ge "$NODE_MIN_MAJOR" ]; then
    ok "node $(node -v)"; record node installed "$(node -v)"
  else
    err "node 安装后版本仍不满足"; record node fail "请手动升级到 v${NODE_MIN_MAJOR}+"
  fi
}

ensure_tool() {   # ensure_tool <命令> <brew> <apt> <dnf> <用途>
  local cmd="$1" b="$2" a="$3" d="$4" why="$5"
  if has "$cmd"; then
    ok "$cmd  ${C_DIM}($(command -v "$cmd"))${C_RST}"
    record "$cmd" ok "$why"
    return
  fi
  warn "未找到 ${cmd}（${why}）"
  if [ "$CHECK_ONLY" = true ]; then record "$cmd" missing "$why"; return; fi
  if [ -z "$PKG" ]; then no_pkg_manager_hint; record "$cmd" missing "请手动安装"; return; fi
  info "安装 $cmd ..."
  if pkg_install "$b" "$a" "$d" && has "$cmd"; then
    ok "$cmd 已安装"; record "$cmd" installed "$why"
  else
    err "$cmd 安装失败"; record "$cmd" fail "$why"
  fi
}

ensure_node
ensure_tool ffmpeg ffmpeg ffmpeg ffmpeg "录屏 mux 成 mp4 / wav 转 mp3"
ensure_tool jq jq jq jq "合成音频脚本读 audio-segments.json"
ensure_tool curl curl curl curl "dev server 健康检查"

# ── 2. Playwright + Chromium ────────────────────────────────────────
step "2/7 Playwright + Chromium（装在 $SKILL_DIR/scripts）"

playwright_ok() {
  (cd "$SKILL_DIR/scripts" && node -e 'require("playwright")' >/dev/null 2>&1)
}
chromium_ok() {
  (cd "$SKILL_DIR/scripts" && node -e '
    const fs = require("fs");
    const p = require("playwright").chromium.executablePath();
    process.exit(fs.existsSync(p) ? 0 : 1);
  ' >/dev/null 2>&1)
}

if ! has node || ! has npm; then
  err "缺 node / npm，跳过 Playwright"
  record playwright fail "先装 node"
elif [ "$CHECK_ONLY" = true ]; then
  if playwright_ok; then ok "playwright 包已装"; else warn "playwright 包未装"; fi
  if playwright_ok && chromium_ok; then
    ok "chromium 已下载"; record playwright ok "包 + chromium"
  else
    warn "chromium 未下载"; record playwright missing "跑 ./install.sh 安装"
  fi
else
  if playwright_ok; then
    ok "playwright 包已装"
  else
    info "npm install（scripts/）..."
    (cd "$SKILL_DIR/scripts" && npm install --no-audit --no-fund)
  fi
  if chromium_ok; then
    ok "chromium 已下载"
    record playwright ok "包 + chromium"
  else
    info "下载 Chromium（约 150MB，首次较慢）..."
    if [ "$OS" = "Linux" ]; then
      (cd "$SKILL_DIR/scripts" && npx playwright install --with-deps chromium)
    else
      (cd "$SKILL_DIR/scripts" && npx playwright install chromium)
    fi
    if chromium_ok; then ok "chromium 已下载"; record playwright installed "包 + chromium"
    else err "chromium 下载失败"; record playwright fail "网络受限可加 --cn 重试"; fi
  fi
fi

# ── 3. skill 软链 ────────────────────────────────────────────────────
step "3/7 skill 软链"
LINK="$SKILLS_DIR/$SKILL_NAME"
if [ "$DO_LINK" = false ]; then
  info "--no-link，跳过"
  record skill-link skipped "--no-link"
elif [ -L "$LINK" ] && [ "$(cd "$LINK" && pwd -P)" = "$(cd "$SKILL_DIR" && pwd -P)" ]; then
  ok "$LINK -> $SKILL_DIR"
  record skill-link ok "$LINK"
elif [ -e "$LINK" ] && [ "$FORCE_LINK" = false ]; then
  warn "$LINK 已存在且指向别处，未改动（--force-link 可替换）"
  record skill-link warn "已存在其它 webvideo"
elif [ "$CHECK_ONLY" = true ]; then
  warn "未链接：$LINK"
  record skill-link missing "跑 ./install.sh 创建"
else
  mkdir -p "$SKILLS_DIR"
  if [ -L "$LINK" ]; then
    rm "$LINK"
  elif [ -e "$LINK" ]; then
    BACKUP="$LINK.bak.$(date +%Y%m%d%H%M%S)"
    mv "$LINK" "$BACKUP"
    info "原目录已备份到 $BACKUP"
  fi
  ln -s "$SKILL_DIR" "$LINK"
  ok "$LINK -> $SKILL_DIR"
  record skill-link installed "$LINK"
fi
if [ -e "$SKILLS_DIR/web-video-presentation" ]; then
  warn "检测到原版 web-video-presentation 也在 ${SKILLS_DIR}，两者触发词相同，建议只保留一个"
fi

# ── 4. 音色目录 ──────────────────────────────────────────────────────
step "4/7 音色目录（IndexTTS 用）"
if [ "$CHECK_ONLY" = true ]; then
  if [ -d "$VOICE_DIR" ]; then
    n=$(find "$VOICE_DIR" -maxdepth 1 -name '*.voice.pt' | wc -l | tr -d ' ')
    ok "${VOICE_DIR}（$n 个 .voice.pt）"; record voices ok "$n 个音色"
  else
    info "$VOICE_DIR 不存在（只有用 indextts 时才需要）"; record voices skipped "未创建"
  fi
else
  mkdir -p "$VOICE_DIR"
  if [ -n "$VOICES_FROM" ]; then
    copied=0
    for f in "$VOICES_FROM"/*.voice.pt; do
      [ -f "$f" ] || continue
      cp -n "$f" "$VOICE_DIR/" && copied=$((copied + 1))
    done
    info "从 $VOICES_FROM 拷入 $copied 个音色（已存在的不覆盖）"
  fi
  n=$(find "$VOICE_DIR" -maxdepth 1 -name '*.voice.pt' | wc -l | tr -d ' ')
  ok "${VOICE_DIR}（$n 个 .voice.pt）"
  record voices ok "$n 个音色"
  if [ "$VOICE_DIR" != "$HOME/.webvideo/voices" ]; then
    info "非默认目录，合成时需 export INDEXTTS_VOICE_DIR=$VOICE_DIR"
  fi
fi

# ── 5. mmx-cli（可选）───────────────────────────────────────────────
step "5/7 mmx-cli（可选，MiniMax 云端 TTS）"
if has mmx; then
  ok "mmx  ${C_DIM}($(command -v mmx))${C_RST}"
  if mmx auth status >/dev/null 2>&1; then
    ok "mmx 已登录"; record mmx ok "已登录"
  else
    warn "mmx 未登录：mmx auth login --api-key sk-xxxxx（key 在 https://platform.minimaxi.com）"
    record mmx warn "未登录"
  fi
elif [ "$WITH_MMX" = false ]; then
  info "未安装；需要时加 --with-mmx"
  record mmx skipped "可选"
elif [ "$CHECK_ONLY" = true ]; then
  warn "未安装"; record mmx missing "可选"
else
  info "npm install -g mmx-cli ..."
  if npm install -g mmx-cli && has mmx; then
    ok "mmx 已安装"
    warn "还需登录：mmx auth login --api-key sk-xxxxx"
    record mmx installed "需登录"
  else
    err "mmx-cli 安装失败（npm 全局目录无写权限时可配 npm prefix）"
    record mmx fail "npm -g 失败"
  fi
fi

# ── 6. indextts（可选）──────────────────────────────────────────────
step "6/7 indextts（可选，本机 IndexTTS-MLX）"
indextts_repo_hint() {
  info "indextts 需要一个已 clone 的 index-tts-mlx 仓库（含 checkpoints/ 模型权重）："
  info "  1) git clone <index-tts-mlx 仓库> && cd index-tts-mlx && git lfs pull"
  info "  2) 按仓库 README 下载 IndexTTS-2 权重到 checkpoints/；Apple Silicon 另按 docs/mlx-convert.md 转 MLX 权重"
  info "  3) ./install.sh --with-indextts --indextts-repo /path/to/index-tts-mlx"
}
if has indextts && [ -z "$INDEXTTS_REPO" ]; then
  ok "indextts  ${C_DIM}($(command -v indextts))${C_RST}"
  record indextts ok "已在 PATH"
elif [ "$WITH_INDEXTTS" = false ]; then
  info "未配置；需要时加 --with-indextts --indextts-repo <dir>"
  record indextts skipped "可选"
elif [ -z "$INDEXTTS_REPO" ]; then
  warn "缺 --indextts-repo"
  indextts_repo_hint
  record indextts missing "缺仓库路径"
elif [ ! -f "$INDEXTTS_REPO/pyproject.toml" ]; then
  err "$INDEXTTS_REPO 不像 index-tts-mlx 仓库（没有 pyproject.toml）"
  record indextts fail "仓库路径不对"
elif [ "$CHECK_ONLY" = true ]; then
  if [ -f "$INDEXTTS_REPO/checkpoints/config.yaml" ]; then ok "模型权重存在"; else warn "缺 checkpoints/config.yaml"; fi
  if has indextts; then record indextts ok "已在 PATH"; else record indextts missing "跑 ./install.sh --with-indextts"; fi
else
  INDEXTTS_REPO="$(cd "$INDEXTTS_REPO" && pwd)"
  if ! has uv; then
    info "安装 uv（官方脚本，装到 ~/.local/bin）..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
  fi
  if ! has uv; then
    err "uv 安装失败"; record indextts fail "缺 uv"
  else
    info "uv sync（$INDEXTTS_REPO/.venv，项目级环境）..."
    (cd "$INDEXTTS_REPO" && uv sync)
    if [ ! -f "$INDEXTTS_REPO/checkpoints/config.yaml" ]; then
      warn "缺 $INDEXTTS_REPO/checkpoints/config.yaml，模型权重还没下载"
      indextts_repo_hint
    fi
    # 包装脚本：indextts 用相对路径找 ./checkpoints，必须在仓库目录里跑
    mkdir -p "$HOME/.local/bin"
    WRAPPER="$HOME/.local/bin/indextts"
    if [ -e "$WRAPPER" ] && ! grep -q "webvideo install.sh" "$WRAPPER" 2>/dev/null; then
      cp "$WRAPPER" "$WRAPPER.bak.$(date +%Y%m%d%H%M%S)"
      info "原 $WRAPPER 已备份"
    fi
    cat > "$WRAPPER" <<EOF
#!/usr/bin/env bash
# generated by webvideo install.sh — run indextts inside the index-tts-mlx repo
# (cd 进仓库，./checkpoints/config.yaml 才能按相对路径解析)
cd "$INDEXTTS_REPO"
exec uv run indextts "\$@"
EOF
    chmod +x "$WRAPPER"
    ok "已写 $WRAPPER -> $INDEXTTS_REPO"
    case ":$PATH:" in
      *":$HOME/.local/bin:"*) ;;
      *) warn "~/.local/bin 不在 PATH，请加到 shell 配置：export PATH=\"\$HOME/.local/bin:\$PATH\"" ;;
    esac
    record indextts installed "$INDEXTTS_REPO"
  fi
fi

# ── 7. 工作区（可选）────────────────────────────────────────────────
step "7/7 多项目工作区（可选）"
if [ -z "$WORKSPACE" ]; then
  info "未指定；需要时加 --workspace <dir>"
  record workspace skipped "可选"
elif [ "$CHECK_ONLY" = true ]; then
  if [ -f "$WORKSPACE/start.sh" ] && [ -d "$WORKSPACE/scripts/node_modules/playwright" ]; then
    ok "$WORKSPACE 已初始化"; record workspace ok "$WORKSPACE"
  else
    warn "$WORKSPACE 未初始化"; record workspace missing "$WORKSPACE"
  fi
else
  mkdir -p "$WORKSPACE/scripts" "$WORKSPACE/projects"
  WORKSPACE="$(cd "$WORKSPACE" && pwd)"
  # 复制而不是软链：render-*.mjs 用自身位置推断 <workspace>/projects，
  # 软链会被 node 解析回 skill 目录
  for f in start.sh stop.sh render-video.sh; do
    cp "$SKILL_DIR/workspace/$f" "$WORKSPACE/$f"; chmod +x "$WORKSPACE/$f"
  done
  for f in render-video.mjs render-covers.mjs extract-chapters.mjs snapshot-chapters.mjs package.json; do
    cp "$SKILL_DIR/scripts/$f" "$WORKSPACE/scripts/$f"
  done
  if has npm; then
    (cd "$WORKSPACE/scripts" && npm install --no-audit --no-fund)
  fi
  ok "${WORKSPACE}（start.sh / stop.sh / render-video.sh / scripts/ / projects/）"
  record workspace installed "$WORKSPACE"
fi

# ── 汇总 ────────────────────────────────────────────────────────────
step "汇总"
fails=0
for row in "${SUMMARY[@]}"; do
  IFS='|' read -r name state note <<< "$row"
  case "$state" in
    ok|installed) color="$C_OK" ;;
    skipped)      color="$C_DIM" ;;
    warn)         color="$C_WARN" ;;
    *)            color="$C_ERR" ;;
  esac
  [ "$name" != mmx ] && [ "$name" != indextts ] && [ "$name" != workspace ] && \
    { [ "$state" = missing ] || [ "$state" = fail ]; } && fails=$((fails + 1))
  printf '  %-12s %s%-10s%s %s\n' "$name" "$color" "$state" "$C_RST" "$note"
done

echo
if [ "$fails" -gt 0 ]; then
  echo "有 $fails 项必装依赖未就绪，见上方提示。"
  exit 1
fi
cat <<EOF
必装依赖已就绪。下一步：
  bash $SKILL_DIR/scripts/scaffold.sh ./presentation --theme=paper-press
  cd presentation && npm run dev          # http://localhost:5174
EOF
