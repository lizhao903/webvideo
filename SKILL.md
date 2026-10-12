---
name: webvideo
description: "把一篇文章或口播稿做成点击驱动的网页演示，可选合成口播音频 + Playwright/ffmpeg 程序化渲染成 mp4；支持横 16:9 / 竖 9:16 / 方形 1:1 三方向（章节项目级单方向，封面单代码多比例）。触发词：用网页做视频、把口播稿做成视频、文章转视频、视频脚本可视化、做动态 PPT、B 站 / YouTube / 视频号 录屏教程、做有电影感的产品 demo、做 talk keynote、合成视频、竖屏视频、手机视频、抖音视频、视频号、Reels、Shorts、给系列所有集统一加开场收尾、系列批量改版、批量套模板到全系列。Do NOT use for：纯静态 PPT（用 prd-visualizer）、UI 原型（用 prd-visualizer 的 frame 类型）、纯文字博客（直接 Markdown）。"
status: active
complexity: L3
metadata:
  author: broleez
  version: 1.14.0
  upstream: web-video-presentation 1.13.0 (lizhao903/garden-skills, fork of ConardLi/garden-skills)
  tags: [video, presentation, web, vite, react, ffmpeg]
  requires:
    - node >= 18
    - npm
    - ffmpeg
    - jq
    - playwright + chromium
  optional:
    - mmx-cli        # MiniMax 云端 TTS + llm-score.py
    - indextts       # 本机 IndexTTS-MLX TTS（需 uv + index-tts-mlx 仓库 + 模型权重）
  install: ./install.sh
---

# webvideo

> 环境安装：在 skill 根目录跑 `./install.sh`（`--check` 只检查、`--all` 连可选 TTS 一起装）。
> dev server 端口统一为 **5174**。

把一篇文章或口播稿，一步步做成可录屏的"伪装成视频的网页"，可选合成
口播音频。产出物 = Vite + React + TS 项目 + 按章节切分的音频。

## 适用场景

- "我有口播稿 / 一篇文章，帮我做成视频" —— 口播驱动的内容
- 想做 "动态 PPT"
- 横 16:9（B 站 / YouTube / 视频号横屏）/ 竖 9:16（抖音 / Reels / Shorts /
  小红书 / 视频号竖屏）/ 方形 1:1（IG / 朋友圈 / 视频号方屏）录屏，
  大字、留白、每屏都要有动效
- 教学 / 产品演示 / keynote 想要电影感
- B 站 / YouTube /抖音 / Reels / Shorts / 视频号 / 小红书视频内容

> **章节项目级单方向**：scaffold 时用 `--orientation=landscape|portrait|square`
> 二选一定下舞台方向，**一个 presentation 项目锁定一种舞台尺寸**。要发横版
> + 竖版两版 = scaffold 两个 presentation 项目，共享外层 workspace 的
> `article.md` / `script.md`。封面与之相反，**单代码 + 修饰类**支持 5 套
> ratio（16x9 / 4x3 / 9x16 / 3x4 / 1x1），一次 `render-covers.mjs` 出齐。

本 Skill **以方法论 + 协作流程为核心**。脚手架模板提供 token 和原语，
但每个美学决策（配色、字型、动效气质）都应该针对你的主题重新设计 ——
不要照搬。

---

## 工作流总览

```
Phase 1   内容编写
   1.1  识别用户输入
   1.2  一次产出 script.md + outline.md
        （口播稿 + 开发计划）
   ▼
[Checkpoint Plan]      ← 必须停。一次对齐 5 件事：
                         稿子 / outline / 主题 / 素材 / 开发模式 +
                         **方向**（横/竖/方形）—— scaffold 时锁死
   ▼
Phase 2   网页开发
   2.1  脚手架（按选定主题 + 选定方向）
   2.2  第 1 章 = 主线程 + 完整版本（强制 anchor）
        ▼
        [硬节点] 用户验收第 1 章 ← 不可跳过
        ▼
   2.3  第 2~N 章（按选定模式：A 逐章 / B 顺序 / C 并行）
   ▼
[Checkpoint Audio]     ← 必须停。是否合成音频
   ▼
Phase 3   音频合成（可选）
   ▼
Phase 4   录屏 + 后期
   ▼
[Checkpoint Distribution]  ← 必须停。是否做分发包（封面 + 简介 + 章节）
   ▼
Phase 5   分发包（可选）
   5.1  抽取 hook 句 / 反差 / 名词 → 5 个变体
   5.2  渲染封面 PNG（默认按项目 .orientation 选 ratio 组合）
         → projects/<slug>/cover/
         landscape: 16x9 + 4x3       (5 × 2 = 10 张)
         portrait : 9x16 + 3x4 + 1x1 (5 × 3 = 15 张)
         square   : 1x1 + 4x3        (5 × 2 = 10 张)
   5.3  生成 ≤250 字 description.md → projects/<slug>/
   5.4  生成 HH:MM:SS chapters.md → projects/<slug>/
```

工作目录约定（agent 在用户当前目录下创建 / 编辑）。**单个视频项目**按方向
**两种布局二选一**（A 单方向 / B 双方向）；用户**做系列**（连续多集）时，
这些项目再统一收进一个**系列目录**——见本节末「布局 C · 系列嵌套」：

### 布局 A · 单方向（扁平，v1.6 兼容）

只做一个方向（横 / 竖 / 方形）时，结构最简单：

```
my-video/
├── article.md          # 用户给原文时必有 —— 不删！开发阶段画面信息源
├── script.md           # 必有：B 站风格口播稿（决定节拍）
├── outline.md          # 必有：开发计划（章节切分 + 每步内容 + 信息池）
├── description.md      # 可选（Phase 5）：≤250 字视频简介，上传时贴
├── chapters.md         # 可选（Phase 5）：HH:MM:SS 章节标记，复制粘到平台简介
├── cover/              # 可选（Phase 5）：按 .orientation 自动选 ratio 组合
│   ├── 01-hook-question.png        # 16:9 (1920×1080，老版本兼容缺省名)
│   ├── 01-hook-question-4x3.png    # 4:3  (1440×1080)
│   ├── 01-hook-question-9x16.png   # 9:16 (1080×1920)
│   ├── 01-hook-question-3x4.png    # 3:4  (1080×1440)
│   ├── 01-hook-question-1x1.png    # 1:1  (1080×1080)
│   └── ...                          # 5 变体 × N ratio（N 视 orientation 而定）
└── presentation/       # 脚手架产出的 Vite + React + TS 项目（单方向）
    ├── .orientation                # scaffold 落标：landscape|portrait|square
    │                                # render-video.mjs / render-covers.mjs 读它
    ├── src/stage.config.ts          # ORIENTATION + STAGE_W + STAGE_H 真相源
    ├── src/chapters/<NN>-<id>/
    │   ├── <Chapter>.tsx     # 视觉实现
    │   ├── <Chapter>.css
    │   └── narrations.ts     # ★ step 数 + 口播文本的唯一真相源
    ├── scripts/
    │   ├── extract-narrations.ts   # 扫所有 narrations.ts → audio-segments.json
    │   └── synthesize-audio.sh     # 调 mmx 合成 mp3
    ├── audio-segments.json         # extract 产出（合成前 review）
    └── public/audio/<id>/<N>.mp3   # 可选：合成的音频
```

### 布局 B · 双方向（v1.7.2+，pc/ + app/ 嵌套）

横版（PC / 桌面 / 横屏分发位）+ 竖版（App / 手机 / 抖音 / Reels / Shorts）
**两版都要做**时，单一项目根下分两个子目录，**每个方向独立管理**口播稿
节奏、大纲、章节代码、封面、视频成片。`article.md` 共享在项目根。

```
my-video/
├── article.md                # 共享原文（横竖版都从这抽细节）
│
├── pc/                       # ── 横版子目录（PC / 桌面 / 横屏分发）
│   ├── script.md             # ★ PC 版口播稿（节拍按横屏 3-8 分钟典型）
│   ├── outline.md            # ★ PC 版开发计划（章节多、step 密）
│   ├── description.md        # Phase 5: PC 分发简介
│   ├── chapters.md           # Phase 5: PC 章节标记
│   ├── cover/                # Phase 5: PC 封面（16x9 + 4x3 缺省组合）
│   └── presentation/         # ★ scaffold --orientation=landscape 到这里
│       ├── .orientation = "landscape"
│       └── ...
│
└── app/                      # ── 竖版子目录（App / 手机 / 抖音 / Reels）
    ├── script.md             # ★ App 版口播稿（节拍按竖屏 30-90 秒典型）
    ├── outline.md            # ★ App 版开发计划（章节少、文案更短）
    ├── description.md        # Phase 5: App 分发简介
    ├── chapters.md           # Phase 5: App 章节标记
    ├── cover/                # Phase 5: App 封面（9x16 + 3x4 + 1x1 缺省组合）
    └── presentation/         # ★ scaffold --orientation=portrait 到这里
        ├── .orientation = "portrait"
        └── ...
```

> **方形 1:1（IG / 朋友圈 / 视频号方形）需要单独出**？双方向布局加一个
> `square/` 子目录，与 pc/ + app/ 平级，里头同样 script.md + outline.md +
> presentation/（`--orientation=square`）。三方向同时维护成本不低，**多数
> 项目不需要**——若做就做。

**为什么 pc / app 分两套口播稿** —— 横屏 3-8 分钟典型节奏跟竖屏 30-90 秒
节奏**完全不同量级**：竖屏单 step 文案≤20-30 字、章节 4-6 章、钩子在
头 1 秒内必须命中；横屏可以单 step 念两三句、章节 6-10 章、钩子前 5-8 秒
铺垫都行。**直接把 PC 版稿子塞进 App 版项目，节奏会塌**（详见
[`SCRIPT-STYLE.md`](references/SCRIPT-STYLE.md) 「按 orientation 调整脚本」段）。

**为什么不共享 outline.md** —— 章节切分对应方向特性：PC 版可以"hero 数字
卡片 + 三栏对照图 + 折线图"密集铺，App 版同样信息只能"单列 hero + 滑动
列表"逐步揭示。**outline 是工程线下游 tasks / system-design / risk-report
的输入**，方向跨界会让评估 / 风险 / 设计全失准。

**章节代码 100% 不复用** —— 字号 / 留白 / 动画方向 / 单 step 步长都按
方向手写，详见 [`CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md)
「竖屏 / 方形排版要点」。哪怕同一主题色 token，章节 `.tsx` 也得**重写一份**。

> **关键**：`narrations.ts` 是 step 数和音频合成的**唯一真相源**。
> 章节 `.tsx` 里的 `if (step === N)` 出现的最大 N + 1 必须等于
> `narrations.length`。这保证 5 处地方（script / outline / 章节代码 /
> chapters.ts / 音频文件）永远不会漂。

### 布局 C · 系列嵌套（v1.10+，多集共用一个系列目录）

用户提到**做系列**（连续多集，如「Agent 自如使用」7 集、「N 分钟搞懂 X」
合集、「第几期 / 第几集」）时，**先在 `projects/` 下建一个系列目录**，本集
及后续每一集都作为**独立项目**放进该系列目录，每集内部仍是布局 A 或 B：

```
projects/
└── <series-slug>/                 # 系列目录（如 系列-如何构建内部agent）
    ├── <series>-glossary.md       # 可选：系列共用名词词典（见下「跨集统一」）
    ├── <NN>-<topic>/              # 第 1 集 = 一个完整项目（布局 A 或 B）
    │   ├── script.md
    │   ├── outline.md
    │   └── presentation/
    ├── <NN>-<topic>/              # 第 2 集 …
    └── ...
```

**规则**：

- **系列目录名**用 kebab-case 或带中文前缀（`系列-<主题>`），用户指定 /
  agent 建议；建好后本集落在它下面，后续集**默认续用同一个系列目录**
- **每集目录名带集号前缀**（`01-` / `agent-howto-01-` 等）便于排序
- **每集完全独立**：自己的 `script.md` / `outline.md` / `.theme` / 方向 /
  章节代码 / 音频 / 封面 / `description.md` / `chapters.md`。集间**不共享**
  `presentation`——做第 N 集就在它自己目录里走完整的 Phase 1→5
- **slug 变成两段** `<series-slug>/<episode-slug>`：render / cover /
  chapters / start 脚本都接受嵌套 slug（也接受裸 `<episode-slug>`，会在
  `projects/` 下**递归查找**一层分类目录）
- **跨集统一**（系列的价值所在）：术语、签名结尾句、集编号引用（E1..EN）、
  版本号 / 记法风格等放进系列目录的 `<series>-glossary.md`，**每集写稿时
  照表用词**，避免跨集漂移；改定义先改 glossary 再改各集脚本

> ⚠️ **系列嵌套比扁平项目深一层目录**。skill 自带的 `scaffold.sh`
> **不用软链、自包含**，不受影响。但如果你的工作区另搭了「相对软链共享
> node_modules / shared 脚手架」之类的省空间外壳，那套软链的相对深度**必须
> 按实际层数算**——`projects/<series>/<ep>/presentation` 比
> `projects/<ep>/presentation` 多一级，每条软链目标要多一个 `../`，否则
> 全断（症状：`npm run` 跑到错的 package.json、Vite 解析不到模块）。

> **系列已经做完、要给所有集统一加/改一次结构**（不是新建系列）？
> 那是另一套流程，见 [`系列批量改版`](#系列批量改版--给已完成系列做统一结构调整v113)
> 一节 + [`references/SERIES-BATCH.md`](references/SERIES-BATCH.md)。

---

## 硬性自检协议（贯穿整个 Skill）

下面三个产出，每一个**完成后必须走自检 → 修复 → 再汇报 / 推进**：

| 产出 | 自检清单出处 |
|---|---|
| `script.md` | [`SCRIPT-STYLE.md`](references/SCRIPT-STYLE.md) 三层自检（形式 / 风骨 / 念出来） |
| `outline.md` | [`OUTLINE-FORMAT.md`](references/OUTLINE-FORMAT.md) 自检 |
| 单章实现完成 | **先跑 `scripts/check-chapters.mjs`**（机器红线）→ 再过 [`CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md) 完工自检（人/agent 判断层）|

> **机器能确定性判定的几条红线，交给脚本，不要再读进上下文逐章手查**：
> `node <skill>/scripts/check-chapters.mjs ./presentation` 一次扫完所有章节的
> ① narrations 长度 ↔ step 渲染数一致 ② 手机字号红线（portrait/square < 24px）
> ③ emoji ④ 紫/粉渐变 ⑤ description.md ≤250。**先把它清零（或加 `--strict` 硬卡）**，
> 剩下的节奏 / 视觉气质 / 内容取舍才走下面的人/agent 判断层。

**执行方式**（剩余判断层，按能力降级，**优先用更隔离的方式**）：

1. **Agent Teams（最优）**：开一个独立的 reviewer agent，给它"产出文件
   路径 + 对应清单 + 关键上下文"，让它逐项核查并**严格汇报结论**
   （哪几条 pass / 哪几条 fail + 证据 + 改写建议）。
2. **subAgent（次优）**：没有 Teams 能力但能开 subagent 就用 subagent
   走同样流程。
3. **自检（兜底）**：当前 agent 都没有上述能力，就自己**严格逐项**
   核查 —— 不允许目测一遍就放行。

**铁律**：拿到结论后**先按 fail 项把产出改完**，再向用户汇报"做完了
+ 自检结论 + 改了什么"。**直接拿原始结论汇报但不修复 = 违规**。

---

## 各阶段文件读取指南

不同阶段读不同的文件。**长会话里 agent 容易遗忘原则**，特别是
Phase 2.4 的"实现单章"会重复 N 次 —— 每次都要回看核心约束。

| 阶段 | 必读（每次都看） | 一次性看完 / 按需查 |
|---|---|---|
| Phase 1.1-1.2 内容编写 | `references/SCRIPT-STYLE.md` + `references/OUTLINE-FORMAT.md` + `article.md`（用户原文，如有） | —— |
| **Checkpoint Plan 选主题** | —— | `themes/*/theme.json`（动态读全部，列清单 + `bestFor` 推荐 + `descriptionZh`）；`references/THEMES.md`（用户想了解主题系统时） |
| Phase 2.1 脚手架 | —— | SKILL.md 本节看一次 |
| **Phase 2.4 实现单章（×N 次，被 2.2 / 2.3 调用）** | **`references/CHAPTER-CRAFT.md`** 单一入口 —— Part 0 十条原则 / Part 1 开工 5 问 / Part 2 关系→动作决策树 / Part 3 视觉工具箱 / Part 4 时长参考 / **手机字号阈值表（< 24px 一律红线）** / Part 5 反 AI 味反模式 / Part 6 代码硬规则（**含 narrations.ts 强制约束 + 中文双引号转义 + chip em padding + 代码块 pre+overflow-x:auto**）/ Part 7 完工自检 / Part 8 反馈速查 + 当前主题的 `themes/<id>/theme.json` + 当前章节的 outline.md 段落 + **`article.md` 本章对应段落** + 素材清单 | `references/EXAMPLES/`（结构示意，不是抄袭模板）；`references/THEMES.md` 完整 token 契约（含可选 font-size token 建议） |
| Phase 3 音频合成 | `references/AUDIO.md`（含 narrations.ts → segments.json → mmx 流程 + **subagent 跑长任务严禁 run_in_background 警告**） | —— |
| Phase 4 录屏 + 后期 | `references/RECORDING.md`（含 `?auto=1` 自动录屏） | —— |
| **Phase 5 分发包（封面 AB + 简介 + 章节）** | **`references/COVER.md`** 单一入口 —— Part 0 为什么 / Part 1 5 变体策略 / Part 2 单变量原则 / Part 3 反 AI 味 / Part 4 渲染流程 / Part 5 description 写作规范 / **Part 5b chapters.md 格式 + 校验** / Part 6 完工自检 / Part 7 AB 测试方法论 / Part 8 模板复用流程 / **Part 9 中文流量打法（左字右脸构图 + 标题 6 公式槽位 + 简介角度 + 两套美学边界）** | `templates/cover/`（5 变体脚手架）；`scripts/extract-chapters.mjs`（章节抽取） |
| 选 / 造 / 切主题 | —— | `references/THEMES.md` |
| **系列批量改版**（给已完成系列统一加/改结构） | **`references/SERIES-BATCH.md`** 单一入口 —— Part 1 核心矛盾（并行 vs 单例资源）/ Part 2 subagent-主控分工 / Part 3 内容一致性 / Part 4 保留优先于覆盖 / Part 5 归档集探测 / Part 6 多音字踩坑 / Part 7 情绪调节 / Part 8 顺手 bug / Part 9 验证够用就好 | —— |

> **写章节时只读一份 `CHAPTER-CRAFT.md`**。十条原则 / 开工 self-prompting /
> 决策树 / 反 AI 味反模式 / 完工自检全部并入这一份单一入口。`EXAMPLES/`
> **不是必读** —— 先按内容自由设计，卡壳才翻（按 anchor 翻"形"，不要照搬）。

---

## Phase 1 —— 内容编写（一次产出）

### 1.1 识别用户输入

| 用户给的东西 | 该做的 |
|---|---|
| 原始文章（书面语 / 公众号 / 论文 / 博客） | 一次产出 `script.md` + `outline.md`（1.2），过 Checkpoint Plan |
| 直接的口播稿 / 视频脚本 | 落盘成 `script.md`，一次产出 `outline.md`（1.2 简化版），过 Checkpoint Plan |
| 啥都没有，只说"帮我做个 X 主题的视频" | **反问**：先给一段素材或大纲。Skill 不替用户构思内容 |

> **先判系列意图**：用户提到「做一个 X 系列」「这是系列第 N 集」「系列
> 视频」「连续做几期」「合集」等意图时，**先在 `projects/` 下建系列目录**
> `projects/<series-slug>/`（名字让用户定 / agent 建议），本集及后续每集
> 都作为独立项目放进去 `projects/<series-slug>/<NN>-<topic>/`，再按上面这张
> 表正常走 Phase 1。**做后续集时默认续用已有系列目录**，不要新建。详见
> 「工作目录约定 · 布局 C · 系列嵌套」。

### 1.1.5 先问 / 推断方向

`script.md` 的字数 / 节拍 / 单 step 文案长度都跟方向强绑定，**写稿前
必须先定方向**。

- **用户明确说**"做横版" / "做抖音版" / "做小红书竖版" → 按用户走
- **用户没说**但提分发平台（"发 B 站"、"发抖音"、"发视频号横屏"）→
  按平台默认：B 站 / YouTube / 视频号横屏 → landscape；抖音 / Reels /
  Shorts / 小红书竖屏 → portrait；IG / 朋友圈 → square
- **用户什么都没说** → **agent 推荐 landscape 单方向**（最通用），并
  在 Checkpoint Plan 第 5 件事里再次确认

**用户明确说"两版都要"** / "横竖都做" / "发 B 站 + 抖音" → **双方向**
模式，按布局 B 在 `pc/` + `app/` 两个子目录各产出一份 `script.md` +
`outline.md`，**节拍按方向分别量级**（详见 [`SCRIPT-STYLE.md`](references/SCRIPT-STYLE.md)
「按 orientation 调整脚本」段）。

### 1.2 一次产出 script.md + outline.md

**两份产出物在一次思考中完成**。**单方向**直接落在 `my-video/` 根；
**双方向**落在对应方向子目录（`my-video/pc/script.md` + `my-video/app/script.md`，
outline 同理）：

1. **生成 `script.md`**：按 [`references/SCRIPT-STYLE.md`](references/SCRIPT-STYLE.md)
   的规则把 article 转 B 站风口播稿。**保留 `article.md` 不删**——它是
   outline 写信息池和章节实现画面时的细节源（双源原则）。**双方向**时
   `pc/script.md` 按横屏 3-8 分钟节奏写，`app/script.md` 按竖屏 30-90 秒
   节奏写（不是简单切短，是重新设计章节切分）。
2. **生成 `outline.md`**：按 [`references/OUTLINE-FORMAT.md`](references/OUTLINE-FORMAT.md)
   规则切章节 + 切 step + 每章首段抽**信息池**。frontmatter 的`方向`字段
   要跟所在子目录对应。

**outline 的边界**（关键）：

| outline 必须写 | outline 不要写 |
|---|---|
| 章节切分 / 每章 step 数 / 估时 | 具体动画类型（blur clear / wipe / 弹簧） |
| 每步屏幕内容（hero / 数据 / 标语 / 列表项） | CSS 实现手段（filter / SVG / clip-path） |
| 章节级**信息池**：从 article 抽的数字 / 引用 / 案例 / 标签 | 时长数值（不写 ~2.5s / 80~120ms） |
| 步级关系名前缀（"反差对照" / "递进列表" / "金句" 等可选 hint） | 持续微动 / 错峰量等微观节奏 |

> **outline 不写动画的理由**：写死动画 = chapter agent 退化为翻译机；
> 留白让 chapter agent 在每步开工时按 [`CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md)
> 的"内容驱动决策树"自由设计，才有真正的视频感。详见
> [`CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md) Part 0 原则 7。

**落盘后必须先走自检再进 Checkpoint Plan**：按上文「硬性自检协议」分别
对 `script.md` / `outline.md` 执行（优先 Agent Teams → subAgent → 自检），
按结论修复完成后再进入 Checkpoint Plan。

---

## Checkpoint Plan —— 5 件事一次对齐（**硬节点**）

`script.md` + `outline.md` 写完后必须停下来。**用户在这一个节点同时确认
5 件事**。

### agent 此时要做的预备工作

1. 读所有 `themes/*/theme.json` 拿 `nameZh` / `descriptionZh` / `bestFor`
   / `mood` —— **不要硬编码清单**
2. 根据 `script.md` 的内容类型 / 关键词 / 语气，**主动**从主题里挑 2~3
   套**最匹配的推荐**（匹配 `bestFor` 字段）
3. 扫一遍 `outline.md` 末尾"素材清单"部分

### 总结模板（骨架，agent 按情况填充）

```
内容计划写完，产出文件：
  📄 article.md     {若用户给原文则保留}
  📄 script.md      {X} 字 / ~{T} 分钟
  📄 outline.md     {N} 章 / {M} 步 + 每章信息池 + 末尾素材清单

章节速览：
  1. <id>     <章节标题>    <S> 步 ~<T>s
  2. ...

接下来一次对齐 5 件事：

  1. 稿子 (script.md) 要不要改？
     可以直接编辑文件，或口头告诉我修改方向。

  2. 开发计划 (outline.md) 要不要改？重点看：
     - 章节切分 / step 数 / 估时是否合理（合理判断：每章 30~60s）
     - 每步屏幕内容是否清晰
     - 每章首段「信息池」是否有足够的 article 细节供画面挂
     - 末尾素材清单是否完整

  3. 选哪个主题？我的推荐：
     ★ <推荐 1：nameZh (id)> — 因为 <bestFor 命中>；<descriptionZh 摘要>
     ★ <推荐 2 / 推荐 3>
     其它可选：<剩余主题，nameZh + 一句话>
     也可以让我帮你做新主题（详见 references/THEMES.md）。

  4. 真素材怎么准备？粗看本视频要的图：<列粗略清单>
     a) 我从 <现有素材路径> 帮你挑   b) 你自己提供   c) 全部 placeholder

  5. 开发模式 + **舞台方向**选哪个？

     **方向**（项目级单方向，scaffold 时锁死，后期不能改）：
       • landscape (默认) — 1920×1080，B 站 / YouTube / 视频号横屏主战场
       • portrait        — 1080×1920，抖音 / 视频号竖版 / Reels / Shorts / 小红书
       • square          — 1080×1080，IG / 朋友圈 / 视频号方形

       **单方向**：扁平布局 `my-video/presentation/`（v1.6 兼容）。
       **双方向**（两版都要发）：嵌套布局 `my-video/pc/presentation/`
       (--orientation=landscape) + `my-video/app/presentation/`
       (--orientation=portrait)，每个方向**独立的 script.md / outline.md
       / cover / description.md / chapters.md**（在子目录里）；
       `article.md` 共享在 my-video 根。详见上方「工作目录约定」布局 A/B。

     **开发模式**：第 1 章无论哪种模式都必须主线程做完 + 用户验收（强制
     anchor）。差异在第 2 章及之后：

     A) 默认 · 逐章确认（推荐）
        每章做完都暂停验收 → 风险可控 / 节奏最稳
     B) 第 1 章后顺序开发（不并行）
        第 2~N 章主线程顺序做完后统一验收 → 速度中 / 适合 agent 不支持并行
     C) 第 1 章后并行开发（subagent）
        第 2~N 章用 subagent 并行 → 最快 / 用户控并行数（一次几章）
        ⚠️ 风格各章会有差异（这是预期，主题禁区兜底）
```

收到反馈后：
- 稿子 / outline 要改：直接编辑文件，编辑完 ping 一次（或口头描述 agent 改）
- **主题必须明确**才进入 Phase 2。用户说"主题你帮我选" → 取你推荐的第 1 个，
  **告诉用户你选了什么、为什么**，给反悔机会
- 模式选定 → 进 Phase 2

---

## Phase 2 —— 网页开发

### 2.1 脚手架

#### 单方向（扁平布局）

```bash
# 默认横屏 16:9（v1.6 兼容写法）
bash <path-to-webvideo>/scripts/scaffold.sh \
  ./presentation \
  --theme=<用户选的主题 id>

# 竖屏 9:16（抖音 / Reels / Shorts / 小红书 / 视频号竖版）—— 单方向
bash <path-to-webvideo>/scripts/scaffold.sh \
  ./presentation \
  --theme=<id> \
  --orientation=portrait

# 方形 1:1 —— 单方向
bash <path-to-webvideo>/scripts/scaffold.sh \
  ./presentation \
  --theme=<id> \
  --orientation=square
```

#### 双方向（嵌套 pc/ + app/ 布局，v1.7.2+）

横版 + 竖版**都要发**，在 `my-video/` 根下分两个子目录各自 scaffold：

```bash
# 横版（PC / 桌面 / 横屏分发）落到 pc/presentation/
bash <path-to-webvideo>/scripts/scaffold.sh \
  ./pc/presentation \
  --theme=<id> \
  --orientation=landscape

# 竖版（App / 手机 / 抖音 / Reels / Shorts）落到 app/presentation/
bash <path-to-webvideo>/scripts/scaffold.sh \
  ./app/presentation \
  --theme=<id> \
  --orientation=portrait
```

两个 presentation 项目独立：自己的 chapters / narrations / 章节代码 /
package.json。**口播稿 / 大纲 / 封面 / 简介 / 章节标记** 也都按方向
分开放在 `pc/` 和 `app/` 子目录里（**不放在 my-video 根**），只有
`article.md` 共享在根（详见「工作目录约定」布局 B）。

```bash
bash <path-to-webvideo>/scripts/scaffold.sh --list-themes
```

`--orientation` 缺省 = landscape，**不传完全等价于 v1.6 旧行为**。scaffold
完后 presentation 项目根有两个标记文件：

- `.theme` —— 选用的主题 id（已有）
- `.orientation` —— landscape / portrait / square（v1.7 新增），录渲 /
  封面脚本读它选 viewport / ratio 组合

> 自定义主题 → 先按 [`references/THEMES.md`](references/THEMES.md)
> "创作新主题"流程做一个 `themes/<my-theme>/`，再 `--theme=<my-theme>`。
>
> **竖屏 / 方形项目的字号阈值更严** —— 详见
> [`references/CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md)「手机端可读
> 字号下限」+「竖屏 / 方形排版要点」。

脚手架带一个 `01-example` demo。在写第一章真实内容前**删掉**：

```bash
rm -rf presentation/src/chapters/01-example
```

并把 `presentation/src/registry/chapters.ts` 里 `EXAMPLE_CHAPTER`
的 import 和数组项移除。

### 2.2 第 1 章 —— 主线程 + 强制验收

**核心**：第 1 章 = 完整版本一次到位（节奏 + 视觉 + 真素材齐全）。
**没有"骨架版"概念** —— 第一章就要做出**用户能直接验收**的样板。

为什么第 1 章必须主线程：

- 它是 [`CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md) 这套指引在**当前
  主题 + 当前题材**下的第一次落地
- 如果指引有盲区 / 主题颜色 / 字体 token 不够用，第 1 章一定会暴露 ——
  这时候有人类反馈就能修指引 / 调主题，**早改成本最低**
- 后续章节（无论顺序 / 并行）都要参考第 1 章的代码模式，所以第 1 章 =
  当次项目的"风格锚点（不强求章节间一致，但单章自身得有完整说服力）"

**做完第 1 章后必须停下来**等用户验收：

```
第 1 章 <id> 做完了，dev server 在 localhost:5174 运行。

验收重点：
  □ 视觉气质对不对？符合 <theme nameZh> 的预期吗？
  □ 节奏对不对？某些步太快 / 太慢 / 信息太薄？
  □ 内容驱动动画是否到位？还是有几步是无脑入场动画？
  □ 双源原则：屏幕画面有没有"口播没念但 article 能挂"的细节？
  □ 反 AI 味检查：紫粉渐变 / 圆角彩色边框 / 假插画 / emoji 是否有？

问题告诉我，我针对性改。OK 了告诉我"继续"，我按选定模式做第 2 章及之后。
```

### 2.3 第 2~N 章 —— 按选定模式

**所有模式下的共同规则**：每章独立按 [`CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md)
开发。**风格不强求章节间完全一致** —— 主题颜色 / 字体 token 兜底视觉
统一，动画 / 节奏 / 视觉演示由章节自由发挥是设计预期。

#### 模式 A · 默认 · 逐章确认

第 2 章做完 → 暂停验收 → OK → 第 3 章 → 暂停 → ... → 第 N 章。**每章
独立验收**，问题随时改，**风险最低，节奏最稳**。**用户不明确选模式时
默认走这个**。

#### 模式 B · 第 1 章后顺序开发

第 2 章 → 第 3 章 → ... → 第 N 章 **主线程顺序做完，最后统一验收**。
速度中等，适合 agent 不支持并行任务的环境。

#### 模式 C · 第 1 章后并行开发（subagent）

用 subagent 把第 2~N 章并行做完，最大并行数由用户控制（"一次 4 章"
/ "一次 2 章"）。**最快，但风格各章会有差异** —— 这是预期，因为：

1. 每个 subagent 看不到别的 subagent 产出，无法机械对齐
2. 章节代码物理分离（每章一个文件夹 / 自己的 CSS 前缀），不会互相
   破坏
3. 主题 token 兜底视觉统一（颜色 / 字体 / hero 数字 / 卡片 / 分割线
   性格 / 装饰），气质不会跑偏
4. **风格不一致 = 人手写视频的呼吸感**（多 voice / 多视角）

并行 subagent 的 prompt 必须包含：

- 当前章节 outline 段落（含信息池）
- `references/CHAPTER-CRAFT.md` 的路径（**单一必读** —— 视觉演示要求 +
  逐步揭示 + 双源原则 + 反 AI 味 + 代码红线 + 完工自检全部在这一份里）
- 当前主题 `theme.json` 的 `descriptionZh` / `mood` / `bestFor`（参考气质
  即可，动画 / 时长 / 字号 / emoji 由 chapter agent 自由决定）
- **第 1 章代码作为"代码风格"参考**（不是"视觉抄袭对象"）
- 硬规则：每章独立 CSS 前缀（`.cd-` / `.mg-` / `.pm-` / ...）；
  不修改 `chapters.ts`；完工跑 `npx tsc --noEmit`

**重要**：无论选哪种模式，**用户随时可以中途切换模式**。第 2 章 OK
后用户说"剩下的并行" / "剩下的逐章" 都行。

### 2.4 实现单章（每章必走）

详细指引见 [`references/CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md) ——
**单一必读入口**，覆盖：视觉演示要求 / 逐步揭示 / 内容取舍 / 双源原则
/ 视频演示基本审美 / 反 AI 味 / 代码红线 / 完工自检。

**核心要点**（CHAPTER-CRAFT.md 详述）：

- **每章必须有 CSS / SVG / Canvas / JS 视觉演示**，禁纯文字章节
- **逐步揭示**：清单 / 列表必须 1 项 = 1 step，禁一次全展示
- **双源原则**：节奏跟口播稿（顺序不能乱），细节回原文章抽（信息池 +
  本章 article 段落）
- **完工自检逐项过**，不达标回去改 —— 先 `node <skill>/scripts/check-chapters.mjs
  ./presentation` 把机器红线（step 数 / 字号 / emoji / 紫粉渐变）清零，再按上文
  「硬性自检协议」走人/agent 判断层，**改完再向用户汇报本章交付**

### 2.5 大改后 bump STORAGE_KEY

改动 `chapters.ts`（增加 / 删除 / 重排章节，或某章 `narrations.ts`
长度变化）后，**bump** `presentation/src/hooks/useStepper.ts` 的
`STORAGE_KEY`（如 `v4` → `v5`），避免持久化游标落到不存在的 step 上。

---

## Checkpoint Audio —— 是否合成音频（**硬节点**）

Phase 2 结束后必须停下来，问用户：

```
网页做完，{N} 章 {M} 步，dev server 在 localhost:5174 跑着。

要不要合成音频做"自动播放录屏"？
  ✓ 合成 → 扫所有章节的 narrations.ts 出 audio-segments.json，
           调 mmx-cli 合成每步一个 mp3 到 public/audio/。
           合成完后用 ?auto=1 模式可以一镜到底录屏（音视频天然同步）。
           本机没装 mmx 会问你用什么 TTS。
  ✗ 不合成 → 跳过 Phase 3，直接 Phase 4 用手动录屏 + 后期配音。
```

要合成 → Phase 3。不合成 → 直接 Phase 4。

---

## Phase 3 —— 音频合成（可选）

详细流程见 [`references/AUDIO.md`](references/AUDIO.md)。简版：

```bash
# 单方向项目
cd presentation
npm run extract-narrations   # 扫所有 narrations.ts → audio-segments.json
# 让用户扫一眼 audio-segments.json 确认文本对
npm run synthesize-audio     # 调 mmx 串行合成；增量、跳过已存在

# 双方向项目（每个方向各跑一次，独立的口播节奏 / 独立的 mp3 池）
cd pc/presentation  && npm run extract-narrations && npm run synthesize-audio
cd ../../app/presentation && npm run extract-narrations && npm run synthesize-audio
```

合成完告诉用户：输出位置 / 总段数 / 哪些段时长异常（太长 = 该 step 拆
分；太短 = 文案太薄）—— 给最后一次校准节奏的机会。然后进入 Phase 4。

---

## Phase 4 —— 录屏 + 后期

详见 [`references/RECORDING.md`](references/RECORDING.md)。两种路径：

| 场景 | 推荐路径 |
|---|---|
| Phase 3 已合成音频 | **Auto 模式一镜到底**：浏览器开 `localhost:5174/?auto=1` → 按 SPACE → 整片自动播完 → 停录 → 裁头尾即成片，**无需后期对音轨** |
| Phase 3 跳过 | 默认 Manual 模式手动点击推进 → 后期任意剪辑工具配音 |

> agent 在 Phase 3 / Checkpoint Audio 后**主动告诉用户**适合的录屏路径。

---

## Checkpoint Distribution —— 是否做分发包（**硬节点**）

Phase 4 出片后必须停下来，问用户。**单方向** slug = `<topic>`；**双方向**
两个 mp4 各自走，slug = `<topic>/pc` 和 `<topic>/app`。**系列项目**（布局 C）
在前面再加系列段：slug = `<series-slug>/<topic>`（脚本递归解析，裸 `<topic>`
也行）：

```
视频 mp4 已经出片：
  单方向：projects/<slug>/video-out/<slug>.mp4
  双方向：projects/<topic>/pc/video-out/pc.mp4  +  projects/<topic>/app/video-out/app.mp4

要不要做"分发包"？= 5 张封面 AB 测试候选 + 1 份 ≤250 字简介 + 1 份
HH:MM:SS 章节标记。这是分发链上**回报最大但最常被忽略**的最后一公里：

  ✓ 全要 → Phase 5 做 5 张封面 PNG + description.md + chapters.md
           （封面用 Playwright 程序化渲染；简介按 4 段式写；章节用脚本
            从 timings.json 抽取）
  ✓ 只要封面 → 5 张 PNG 渲出来，简介 / 章节你自己写
  ✓ 只要章节 → 一行 `extract-chapters.mjs <slug>`
  ✗ 都不要 → 流程结束，直接上传成片

双方向项目分发包**两套独立**：pc/ 和 app/ 各出自己的 cover / description /
chapters（封面 ratio 默认不同，钩子句也常常不一样 —— 横版主打 hook，
竖版主打数字 / 反差 / 一句话挑明）。
```

具体方法论见 [`references/COVER.md`](references/COVER.md)（**Phase 5 时
必读单一入口** —— 含 5 变体策略 / 单变量原则 / 反 AI 味 / 完工自检 /
AB 测试方法论）。

---

## Phase 5 —— 分发包（可选）

详细流程见 [`references/COVER.md`](references/COVER.md)。简版：

### 5.1 起手套用 cover 模板

```bash
# 复制 5 变体脚手架到项目 src/covers/
cp -R <skill>/templates/cover/. \
      projects/<slug>/presentation/src/covers/

# 把 .tpl 改名成 .tsx（让 TypeScript 接管）
cd projects/<slug>/presentation/src/covers/
for f in $(find . -name "*.tpl"); do mv "$f" "${f%.tpl}"; done

# 按 references/COVER.md Part 1~3 替换每个 .tsx 顶部注释列的 {{...}}
# 占位符（eyebrow / footer / hero / 钩子句 / 数字 / vs 等）
```

### 5.2 渲染封面 PNG（缺省按 .orientation 选 ratio 组合）

```bash
# dev server 必须在跑（./start.sh <slug>）

# 单方向项目
node <skill>/scripts/render-covers.mjs <slug>
# 输出：projects/<slug>/cover/<id>.png × 5（+ 按 .orientation 加后缀变体）

# 双方向项目（pc + app 各跑一次）
node <skill>/scripts/render-covers.mjs <topic>/pc      # 横版 → 16x9 + 4x3
node <skill>/scripts/render-covers.mjs <topic>/app     # 竖版 → 9x16 + 3x4 + 1x1
# 输出：
#   projects/<topic>/pc/cover/<id>.png       × 5  ← 16:9 (1920×1080)
#   projects/<topic>/pc/cover/<id>-4x3.png   × 5
#   projects/<topic>/app/cover/<id>-9x16.png × 5  ← 9:16 (1080×1920)
#   projects/<topic>/app/cover/<id>-3x4.png  × 5
#   projects/<topic>/app/cover/<id>-1x1.png  × 5

# 单一比例（省时间）：
#   node <skill>/scripts/render-covers.mjs <slug> --ratio 16x9
#   node <skill>/scripts/render-covers.mjs <slug> --ratio 9x16
```

迭代文案时浏览器开 `localhost:5174/?cover=<id>`（16:9）或
`localhost:5174/?cover=<id>&ratio=4x3`（4:3）实时预览，满意了重渲。

> **为什么默认两套都出**：YouTube / B 站 / 视频号缩略图主图走 16:9，
> 微信公众号头图 / 小红书横屏卡片 / 旧版信息流偏好 4:3。一次性出齐
> 分发包，跨平台投放零返工。详见 [`references/COVER.md`](references/COVER.md)
> Part 4。

### 5.3 写 description.md

```bash
# 单方向：落在项目根
cp <skill>/templates/cover/description.md.tpl \
   projects/<slug>/description.md

# 双方向：pc / app 各一份（钩子句通常不一样，按平台用户匹配）
cp <skill>/templates/cover/description.md.tpl projects/<topic>/pc/description.md
cp <skill>/templates/cover/description.md.tpl projects/<topic>/app/description.md

# 编辑：替换 4 段（钩子 / 价值 / 主题清单 / 受众）
# 校验：wc -m projects/<slug>/description.md  ≤ 250
```

### 5.4 抽取 chapters.md（章节标记）

**前置**：Phase 4 录渲已完成，对应 `video-out/timings.json` 存在。

```bash
# 单方向
node <skill>/scripts/extract-chapters.mjs <slug>
# 输出：projects/<slug>/chapters.md

# 双方向（pc + app 各跑一次）
node <skill>/scripts/extract-chapters.mjs <topic>/pc
node <skill>/scripts/extract-chapters.mjs <topic>/app
# 输出：
#   projects/<topic>/pc/chapters.md
#   projects/<topic>/app/chapters.md
# 格式：HH:MM:SS 章节标题（一行一章）
```

脚本会自动校验：第一行 `00:00:00` / 每章 ≥ 5s / 至少 3 章；任一不达
标会**警告但继续输出**。规范见 [`references/COVER.md`](references/COVER.md)
Part 5b。

### 5.5 完工 5 件自检（强制）

按 [`references/COVER.md`](references/COVER.md) Part 6 逐项过：系列感
/ 单点钩子 / token 纯度 / 字号足够大 / 反 AI 味 / description ≤250 字
/ chapters.md 第一行 00:00 + 每章 ≥5s。**不通过回头改 → 再渲染**。

### 5.6 告诉用户怎么 AB

按 [`references/COVER.md`](references/COVER.md) Part 7 提示用户：

- YouTube Studio 「缩略图测试」3 选一原生 AB
- B 站创作者中心「封面优化」试验功能
- 视频号 / 抖音 / 小红书没原生 AB → 多号分发对照 CTR
- 样本量 ≥ 10K 曝光、观察期 ≥ 7 天、只看 CTR

---

## 系列批量改版 —— 给已完成系列做统一结构调整（v1.13+）

上面 Phase 1-5 是"从零做一个视频"的流程。**系列已经做完（或做完大半），
现在要给每一集统一加/改同一个结构性东西**（比如全系列统一加开场品牌章节、
统一换收尾话术），是完全不同的场景——不是内容创作，是批量运维。

详细方法论见 [`references/SERIES-BATCH.md`](references/SERIES-BATCH.md)，
**先在 1 集上做出样板拿到用户确认，再批量套其余集**。核心要点：

- **每集能并行，但音频合成（本地 TTS 单例进程）和 dev server 验证
  （`start.sh`/`stop.sh` 的 pid/log 固定叫 `app`，多个同时起会互相覆盖）
  两类资源不能并行** —— 正确分工是 subagent 只并行写代码（章节 / CSS /
  narrations.ts + `extract-narrations` + `tsc --noEmit`），音频合成 /
  dev server 截图验证 / 渲染这三步收回主控**串行**跑，一集处理完再下一集
- subagent prompt 要显式列出"不允许做的事情"（不起 dev server / 不跑
  Playwright / 不跑音频合成 / 不渲染 / 不 commit），不能只写职责范围
- 内容一致性：本集文案素材指定读现成文件复用（比如已有的静态封面组件
  常量），跨集信息（下一集是谁）从系列级索引文件查，都不要让 subagent
  临场编
- 已有内容"保留 + 补全"优先于"整段替换"——系列各集历史结构可能不齐，
  批量指令假设"现状是空的"容易冲掉已经写好的更丰富内容
- 系列里可能有归档（打包 zip、原目录删除）的已完成集数，批量前先探测
  哪些是活目录，只对活着的派工
- 本地 TTS 常见坑：单字多音字被高频词带偏读错音调（如"量"），批量写
  文案时换成无歧义双字词；情绪/语气只能靠标点和措辞调，模型没有独立
  情绪参数
- 用 `TaskCreate`/`TaskUpdate` 给每一集建任务追踪，串行链路再长也不丢步

---

## 十条原则（一句话清单）

完整展开见 [`references/CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md)
Part 0 —— **写章节时回那里查**，下面只是索引。

| # | 原则 | 一句话 |
|---|---|---|
| 1 | 项目方向二选一的固定舞台 | 内容 STAGE_W × STAGE_H（横 1920×1080 / 竖 1080×1920 / 方 1080×1080）+ transform scale，没有响应式 |
| 2 | 全局 step 计数器 | 章节是 step 的纯函数，无定时器 |
| 3 | 每步独占整屏 | `if (step === N) return <FullScene />` |
| 4 | 口播节拍 = step | 一节拍 = 一 step = 一聚焦想法 |
| 5 | 隐藏的边角控件 | 进度条 / 翻页器默认 opacity 0 |
| 6 | 舞台无 chrome | 没有 header / footer / 页码 / 品牌条 |
| 7 | **内容驱动动画** | 先找内在动作，找不到才入场动画兜底；持续微动慎用 |
| 8 | 多点逐个揭示 | 1 项 = 1 step，禁同步 stagger 上 N 项 |
| 9 | 整片同一主题 | 章节间不翻表面色；**颜色 / 字体走 token**，其它尺度章节自由 |
| 10 | 双源原则 | script 定节拍，**article 定画面密度**（落到信息池） |

---

## 常见用户反馈速查

简化表见 [`references/CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md)
Part 8「常见反馈速查」。**关键**：先定位是哪一层（节奏 / 视觉 / 内容
/ 代码），再改最小切片，**不要重做整章**。

---

## 相关资源

按"何时读"标注，避免一次性全读：

| 文件 | 何时读 | 内容 |
|---|---|---|
| [`references/SCRIPT-STYLE.md`](references/SCRIPT-STYLE.md) | Phase 1.2 必读 | 文章 → 口播稿规则、平台变体、**TTS 友好文本三类清洗（多音字补全 / 缩写还原 / 单位换中文词，v1.8）** |
| [`references/OUTLINE-FORMAT.md`](references/OUTLINE-FORMAT.md) | Phase 1.2 必读 | outline.md 字段 spec、命名约定、章节切分、信息池 |
| [`references/CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md) | **Phase 2.4 每章单一必读入口** | Part 0 十条原则 / Part 1 开工 5 问 / Part 2 关系→动作决策树 / Part 3 视觉工具箱 / Part 4 时长 / **手机字号阈值表（v1.6 加）** / Part 5 反 AI 味反模式 / Part 6 代码硬规则（**v1.6 新增：中文双引号 / chip em padding / 代码块 pre+overflow-x:auto**）/ Part 7 完工自检 / Part 8 反馈速查 |
| [`references/EXAMPLES/`](references/EXAMPLES/) | **可选** —— 看结构 | 章节结构示意（hook / list-reveal / case-tech-review）；**不是抄袭模板** |
| [`references/THEMES.md`](references/THEMES.md) | 选 / 造 / 切主题时 | 完整 token 契约 + 内置主题清单 + 创作流程 |
| [`references/AUDIO.md`](references/AUDIO.md) | Phase 3 才读 | MiniMax CLI、TTS 退化路径、故障排查（**v1.6 加：subagent 长任务严禁 run_in_background**；**v1.8 加：合成前扫 json 核 TTS 友好文本**） |
| [`references/RECORDING.md`](references/RECORDING.md) | Phase 4 才读 | 录屏工具 + 后期合成 |
| [`references/COVER.md`](references/COVER.md) | **Phase 5 才读，单一入口** | 5 变体 AB 策略 + 单变量原则 + 反 AI 味 + 完工 5 件自检 + description.md 4 段式写作规范 + AB 测试方法论 + **Part 9 中文流量打法（左字右脸 + 标题 6 公式 + 两套美学边界）** |
| [`references/SERIES-BATCH.md`](references/SERIES-BATCH.md) | **系列批量改版才读，单一入口（v1.13 加）** | 给已完成系列所有集统一加/改结构：subagent 并行写代码 + 主控串行跑音频/验证/渲染（本地 TTS 单例 + dev server 命名冲突）、内容一致性（复用现成文案源 / 查系列级索引）、保留优先于覆盖、归档集探测、多音字踩坑、情绪调节靠标点 |
| [`templates/cover/`](templates/cover/) | Phase 5 取模板 | 5 变体 .tsx.tpl + 共享 CoverShell + cover-base.css + types.ts + registry.ts.tpl + description.md.tpl |
| [`scripts/render-covers.mjs`](scripts/render-covers.mjs) | Phase 5 跑一次 / 改文案后重跑 | Playwright headless 按项目 `.orientation` 选缺省 ratio 组合渲染封面 PNG 到 `projects/<slug>/cover/`：landscape = 16x9 + 4x3，portrait = 9x16 + 3x4 + 1x1，square = 1x1 + 4x3。`--ratio 16x9\|4x3\|9x16\|3x4\|1x1\|both` 可单跑一套 |
| [`scripts/extract-chapters.mjs`](scripts/extract-chapters.mjs) | Phase 5 录渲后跑一次 | 从 `video-out/timings.json` + `chapters.ts` 抽 `HH:MM:SS 章节标题`，输出 `projects/<slug>/chapters.md`（含 ≥5s / 第一章 00:00 / ≥3 章 校验）|
| [`themes/`](themes) | Checkpoint Plan / Phase 1.2 时翻 | 内置主题（每个含 `theme.json` + `tokens.css`） |
| [`scripts/scaffold.sh`](scripts/scaffold.sh) | Phase 2.1 跑一次 | 一键项目脚手架 |
| [`scripts/check-chapters.mjs`](scripts/check-chapters.mjs) | **每章完工先跑** | 章节硬规则静态 lint（无依赖）：narrations↔step 数一致 / 手机字号红线（按 `.orientation`）/ emoji / 紫粉渐变 / description≤250 / **online-font-import（章节及本地覆盖入口引在线 Google Fonts，程序化渲染会掉字，warning，`--strict` 升 error）/ self-id-selector（裸全局选择器 `body`/`h1`/`.title`/`.card` 无本章前缀会跨章泄漏，warning）**。`--strict` 可硬卡。把机器能定的红线从上下文里拿出来 |
| [`scripts/snapshot-chapters.mjs`](scripts/snapshot-chapters.mjs) | **每章完工视觉自检（check-chapters 的视觉补充）** | 连已跑的 dev server，按每章 `narrations.ts` 把每个 step 截一张 PNG，拼成 HTML contact-sheet（`<presentation>/snapshots/index.html`）供人/视觉模型审阅，并核对 step 数↔截图数。读 `.orientation` 选 viewport；Playwright 用 `./install.sh` 装进 skill 自带 `scripts/` 的那份（或 `$WEBVIDEO_PLAYWRIGHT_DIR`）。用法 `node scripts/snapshot-chapters.mjs [presentation-dir] [--port 5174] [--scale 0.25]` |
| [`llms.txt`](llms.txt) / [`references/INDEX.md`](references/INDEX.md) | 想快速定位读哪个文件时 | references 机器可读索引（`gen-index.mjs` 自动生成；每文件附「何时读」+ 一行用途）|
| [`scripts/gen-index.mjs`](scripts/gen-index.mjs) / [`scripts/docs.mjs`](scripts/docs.mjs) | 重生成索引 / 离线查段落 | `gen-index.mjs` 扫 references 重生成 llms.txt + INDEX.md（`--check` 校验过期）；`docs.mjs <topic>` 把对应 reference 关键段打到终端（topic: script\|outline\|chapter\|theme\|audio\|record\|cover）|
