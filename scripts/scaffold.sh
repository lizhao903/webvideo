#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# scaffold.sh —— 一键脚手架，创建一个 video-presentation 项目。
#
# 用法：
#   bash scripts/scaffold.sh <target-dir> [--theme=<id>] [--orientation=landscape|portrait|square]
#   bash scripts/scaffold.sh --list-themes
#
# 例子：
#   bash <path-to-webvideo>/scripts/scaffold.sh ./presentation
#   bash <path-to-webvideo>/scripts/scaffold.sh ./talk --theme=paper-press
#   bash <path-to-webvideo>/scripts/scaffold.sh ./shorts --orientation=portrait
#   bash <path-to-webvideo>/scripts/scaffold.sh ./square --orientation=square --theme=midnight-press
#   bash <path-to-webvideo>/scripts/scaffold.sh --list-themes
#
# **orientation 是项目级单方向**（章节代码物理决定舞台尺寸）。要在两
# 个方向都发，**scaffold 两个独立项目**，共享 workspace 根的 article.md /
# script.md。一个项目不能同时跑横屏 + 竖屏。
#
# 跑完后，看 SKILL.md "Phase 2.4 实现单章" + references/CHAPTER-CRAFT.md
# 了解每章怎么写。卡壳时翻 references/EXAMPLES/ 找完整章节 anchor。
#
# 之后切换主题，覆盖一个文件即可：
#   cp <path-to-webvideo>/themes/<id>/tokens.css \
#      <project>/src/styles/tokens.css
# ─────────────────────────────────────────────────────────────
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATES="$SKILL_DIR/templates"
THEMES_DIR="$SKILL_DIR/themes"
DEFAULT_THEME="midnight-press"
DEFAULT_ORIENTATION="landscape"

list_themes() {
  echo "可用主题（来自 ${THEMES_DIR}）:"
  echo
  for dir in "$THEMES_DIR"/*/; do
    [[ -d "$dir" ]] || continue
    local meta="$dir/theme.json"
    [[ -f "$meta" ]] || continue
    # 没有 jq，简单 grep + sed 提字段
    local id name desc
    id=$(grep -E '"id"' "$meta" | head -n1 | sed -E 's/.*"id":[[:space:]]*"([^"]+)".*/\1/')
    name=$(grep -E '"nameZh"' "$meta" | head -n1 | sed -E 's/.*"nameZh":[[:space:]]*"([^"]+)".*/\1/')
    desc=$(grep -E '"descriptionZh"' "$meta" | head -n1 | sed -E 's/.*"descriptionZh":[[:space:]]*"([^"]+)".*/\1/')
    printf "  • %-18s %s\n      %s\n\n" "$id" "$name" "$desc"
  done
  echo "用 --theme=<id> 选定一个。默认：${DEFAULT_THEME}。"
  echo
  echo "另一个常用参数 --orientation=landscape|portrait|square："
  echo "  landscape (默认) — 1920×1080，B站 / YouTube / 视频号横屏主战场"
  echo "  portrait        — 1080×1920，抖音 / 视频号竖版 / Reels / Shorts / 小红书"
  echo "  square          — 1080×1080，Instagram / 微信视频号方形 / 朋友圈"
  echo "  要发两个方向 = scaffold 两个独立项目，共享外层 article.md / script.md。"
}

# ── 解析参数 ──
TARGET=""
THEME="$DEFAULT_THEME"
ORIENTATION="$DEFAULT_ORIENTATION"
for arg in "$@"; do
  case "$arg" in
    --list-themes)
      list_themes
      exit 0
      ;;
    --theme=*)
      THEME="${arg#--theme=}"
      ;;
    --orientation=*)
      ORIENTATION="${arg#--orientation=}"
      ;;
    --*)
      echo "✗ 未知参数: $arg" >&2
      exit 1
      ;;
    *)
      if [[ -z "$TARGET" ]]; then TARGET="$arg"; fi
      ;;
  esac
done

# 校验 orientation 并算尺寸
case "$ORIENTATION" in
  landscape)
    STAGE_W=1920; STAGE_H=1080
    ;;
  portrait)
    STAGE_W=1080; STAGE_H=1920
    ;;
  square)
    STAGE_W=1080; STAGE_H=1080
    ;;
  *)
    echo "✗ 未知 --orientation: ${ORIENTATION}（可选: landscape / portrait / square）" >&2
    exit 1
    ;;
esac

TARGET="${TARGET:-presentation}"
THEME_DIR="$THEMES_DIR/$THEME"
THEME_TOKENS="$THEME_DIR/tokens.css"

if [[ ! -d "$THEME_DIR" || ! -f "$THEME_TOKENS" ]]; then
  echo "✗ 找不到主题 '$THEME'。可用主题：" >&2
  echo >&2
  for dir in "$THEMES_DIR"/*/; do
    [[ -d "$dir" ]] || continue
    echo "    • $(basename "$dir")" >&2
  done
  exit 1
fi

if [[ -d "$TARGET" && -n "$(ls -A "$TARGET" 2>/dev/null || true)" ]]; then
  echo "✗ 目标目录 '$TARGET' 已存在且非空，已中止。" >&2
  exit 1
fi

if ! command -v npm >/dev/null; then
  echo "✗ 需要 npm，但在 PATH 里没找到。" >&2
  exit 1
fi

echo "▸ 在 $TARGET 创建 Vite + React + TS 项目"
echo "▸ 使用主题：$THEME"
echo "▸ 舞台方向：${ORIENTATION}（${STAGE_W}×${STAGE_H}）"
npm create vite@latest "$TARGET" -- --template react-ts >/dev/null

cd "$TARGET"
echo "▸ 安装依赖（可能要等一会）..."
npm install >/dev/null 2>&1

echo "▸ 安装 tsx（用于 extract-narrations 脚本）..."
npm install --save-dev tsx >/dev/null 2>&1

echo "▸ 用演示骨架替换默认 boilerplate"

# 干掉我们不要的 Vite 默认 boilerplate
rm -f \
  src/App.tsx src/App.css \
  src/main.tsx src/index.css \
  src/assets/react.svg \
  public/vite.svg \
  README.md
rmdir src/assets 2>/dev/null || true

# 把脚手架文件拷到项目根
mkdir -p \
  src/styles src/hooks src/components src/registry \
  src/chapters/01-example \
  src/covers \
  public scripts

cp "$TEMPLATES/vite.config.ts" .
cp "$TEMPLATES/index.html" .

cp "$TEMPLATES/src/main.tsx" src/main.tsx
cp "$TEMPLATES/src/App.tsx"  src/App.tsx

# stage.config.ts —— 舞台尺寸的唯一真相源。按 orientation 替换 3 个占位符。
# 用 sed 写到目标文件（macOS sed 不带 -i 的 in-place 不一样，先 cat 出来）
sed \
  -e "s/{{ORIENTATION}}/$ORIENTATION/g" \
  -e "s/{{STAGE_W}}/$STAGE_W/g" \
  -e "s/{{STAGE_H}}/$STAGE_H/g" \
  "$TEMPLATES/src/stage.config.ts" > src/stage.config.ts

# tokens.css 来自所选主题
cp "$THEME_TOKENS"                          src/styles/tokens.css
cp "$TEMPLATES/src/styles/base.css"         src/styles/base.css
cp "$TEMPLATES/src/styles/animations.css"   src/styles/animations.css
cp "$TEMPLATES/src/styles/fonts.css"        src/styles/fonts.css

cp "$TEMPLATES/src/hooks/useStageScale.ts"     src/hooks/useStageScale.ts
cp "$TEMPLATES/src/hooks/useStepper.ts"        src/hooks/useStepper.ts
cp "$TEMPLATES/src/hooks/useAudioPlayer.ts"    src/hooks/useAudioPlayer.ts
cp "$TEMPLATES/src/hooks/useAutoMode.ts"       src/hooks/useAutoMode.ts
cp "$TEMPLATES/src/hooks/useRenderTimings.ts"  src/hooks/useRenderTimings.ts

cp "$TEMPLATES/src/components/Stage.tsx"          src/components/Stage.tsx
cp "$TEMPLATES/src/components/MaskReveal.tsx"     src/components/MaskReveal.tsx
cp "$TEMPLATES/src/components/ProgressBar.tsx"    src/components/ProgressBar.tsx
cp "$TEMPLATES/src/components/ProgressBar.css"    src/components/ProgressBar.css
cp "$TEMPLATES/src/components/AutoStartGate.tsx"  src/components/AutoStartGate.tsx
cp "$TEMPLATES/src/components/AutoStartGate.css"  src/components/AutoStartGate.css
cp "$TEMPLATES/src/components/AutoToggle.tsx"     src/components/AutoToggle.tsx
cp "$TEMPLATES/src/components/AutoToggle.css"     src/components/AutoToggle.css

cp "$TEMPLATES/src/registry/types.ts"    src/registry/types.ts
cp "$TEMPLATES/src/registry/chapters.ts" src/registry/chapters.ts

cp "$TEMPLATES/src/chapters/01-example/Example.tsx"     src/chapters/01-example/Example.tsx
cp "$TEMPLATES/src/chapters/01-example/Example.css"     src/chapters/01-example/Example.css
cp "$TEMPLATES/src/chapters/01-example/narrations.ts"   src/chapters/01-example/narrations.ts

# Empty cover registry so App.tsx's CoverMode import resolves cleanly
# before Phase 5 fills it in. See references/COVER.md for the actual
# distribution-pack flow (5 variants + description.md).
cat > src/covers/registry.ts <<'COVERSEOF'
/**
 * Cover registry —— Phase 5 (分发包) 时填入。空数组让 App.tsx 的
 * CoverMode import 永远成功；URL ?cover=X 在空 registry 下会落到
 * "unknown cover id" 提示分支，不影响正片。
 *
 * 起手做封面：
 *   cp -R <skill>/templates/cover/ src/covers/
 *   for f in $(find src/covers -name "*.tpl"); do mv "$f" "${f%.tpl}"; done
 *   # 然后按 references/COVER.md 替换占位符
 */
export const COVERS: Array<{
  id: string;
  variant: string;
  hypothesis: string;
  Component: import("react").ComponentType;
}> = [];
COVERSEOF

# Audio pipeline scripts (extract-narrations + synthesize-audio + indextts variant).
cp "$TEMPLATES/scripts/extract-narrations.ts"         scripts/extract-narrations.ts
cp "$TEMPLATES/scripts/synthesize-audio.sh"           scripts/synthesize-audio.sh
cp "$TEMPLATES/scripts/synthesize-audio-indextts.sh"  scripts/synthesize-audio-indextts.sh
chmod +x scripts/synthesize-audio.sh scripts/synthesize-audio-indextts.sh

# Wire the audio scripts into npm so contributors don't have to remember
# the exact command. Uses node to merge into the existing package.json.
node -e '
const fs = require("fs");
const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
p.scripts = Object.assign({}, p.scripts, {
  "extract-narrations":      "tsx scripts/extract-narrations.ts",
  "synthesize-audio":        "bash scripts/synthesize-audio.sh",
  "synthesize-audio-indextts": "bash scripts/synthesize-audio-indextts.sh",
});
fs.writeFileSync("package.json", JSON.stringify(p, null, 2) + "\n");
'

# 留个标记，以后能查这个项目从哪个主题起步的
{
  echo "$THEME"
} > .theme

# 落 .orientation：录渲脚本 render-video.mjs / render-covers.mjs 都读这个
# 决定 viewport 尺寸 / 缺省 ratio 组合。值是纯文本（landscape/portrait/square）。
{
  echo "$ORIENTATION"
} > .orientation

# 跑一次 typecheck 确认接线 OK
echo "▸ 跑 typecheck ..."
if npx tsc --noEmit; then
  echo "✓ typecheck 通过"
else
  echo "✗ typecheck 失败 —— 请看上面的错误" >&2
  exit 1
fi

cat <<EOF

✓ 完成。下一步：

  1. cd $TARGET
  2. npm run dev      # 默认 http://localhost:5174（被占会自动换端口）

当前主题：${THEME}（见 .theme）
当前方向：${ORIENTATION} —— 舞台 ${STAGE_W}×${STAGE_H}（见 .orientation + src/stage.config.ts）

  ⚠️ orientation 在 scaffold 时就锁死，不能后改。要换方向 = 重新
     scaffold 一个新项目，共享 workspace 根的 article.md / script.md。
     不要手动改 .orientation 或 stage.config.ts —— 章节代码默认按
     原方向写的字号 / 留白，跨方向直接复用会破。

然后：

  • 点舞台任意位置推进全局 step 计数器。
  • 鼠标移到底部边缘可显出进度条；鼠标移到右上角可显出播放模式切换。
  • 把 src/chapters/01-example/ 替换成你自己的章节
    （流程见 SKILL.md "Phase 2.4 实现单章" —— 每章一次到位完整版本，
     不分骨架 / 精修两步；动画选型由 chapter agent 按 CHAPTER-CRAFT.md
     Part 0 原则 7 + Part 1 五问决定）。
  • 在 src/registry/chapters.ts 注册每个新章节。
  • **每章必须有 narrations.ts**（与 Example.tsx 同目录），
    数组长度 = step 数，是音频合成 + Auto 模式的唯一真相源。
  • 章节改了就 bump src/hooks/useStepper.ts 的 STORAGE_KEY 末尾版本号。

录制：

  • 手动模式：直接打开 http://localhost:5174（点击 / 方向键推进）
  • 半自动：URL 加 ?audio=1 — 音频跟 step 切，但你手动推进
  • 全自动录屏：URL 加 ?auto=1 — 按一次 SPACE 启动，整片自动播 + 推进
                按 M 键随时切换三种模式。

音频合成（可选，录制前做）：

  npm run extract-narrations           # 扫所有章节 narrations.ts → audio-segments.json
  npm run synthesize-audio             # mmx-cli（MiniMax 云端）→ .mp3
  npm run synthesize-audio-indextts    # 本机 IndexTTS-MLX（默认 broleez 音色）
                                       # 加 --sincere-adult 切到 sincere-adult 音色
                                       # 详见 references/AUDIO.md

写章节时必读（单一入口，路径在 SKILL 仓库内）：

  • $SKILL_DIR/references/CHAPTER-CRAFT.md
      Part 0 十条原则 / Part 1 开工 5 问 / Part 2 关系→动作决策树 /
      Part 3 视觉工具箱 / Part 4 时长 / Part 5 反 AI 味反模式 /
      Part 6 代码硬规则 / Part 7 完工自检 / Part 8 反馈速查
  • $SKILL_DIR/themes/$THEME/theme.json
      看 descriptionZh / mood / bestFor —— 参考主题气质
      （动画 / 时长 / 字号 / emoji 由 chapter agent 在每章自由决定）

卡壳时可翻：

  • $SKILL_DIR/references/EXAMPLES/
      完整章节 anchor（钩子型 / 列举型）—— 看"形"，不要照搬

要换一个主题，覆盖 tokens.css 即可：
  cp $SKILL_DIR/themes/<id>/tokens.css src/styles/tokens.css

想自创主题，看 $SKILL_DIR/references/THEMES.md。

EOF
