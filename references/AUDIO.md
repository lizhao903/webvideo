# 音频合成

把每个章节 `narrations.ts` 里的口播文字按 **step 颗粒度**合成 mp3，
落到 `presentation/public/audio/<chapter-id>/<step-N>.mp3`。运行时
Auto 模式会自动按 step 播放并自动推进——录屏可以一镜到底。

> **真相源**：每个章节的 `src/chapters/<NN>-<id>/narrations.ts` 是 step
> 数 + 口播文本的**唯一来源**。`outline.md` 不再参与音频合成，章节代码
> 也不再手写 `totalSteps`。这一改根除了"网页 step 和音频文件数对不上"
> 这个老问题。

默认用 **MiniMax CLI（`mmx-cli`）**。本机没装就**询问用户**用什么 TTS，
不要悄悄假装合成成功。

---

## ⚠️ subagent 跑长任务严禁用 `run_in_background`（踩过两次）

> **场景**：合成 10+ 段音频是几分钟级别的长任务，agent 容易想"开 subagent
> 加 `run_in_background: true` 在后台跑，主线程不被阻塞"。**这条路是错的**。

**实战教训**：MLX 系列音频合成踩坑两次。subagent 内部用 Bash 工具 +
`run_in_background: true` 启动 `indextts batch` / `npm run synthesize-audio`，
subagent 自己 return 后**它启动的 background 子进程会被 SIGTERM 杀掉**
（subagent 作为父进程退出，OS 把所有 children 收回）。结果：日志里看
"已启动后台进程 PID xxxxx"，实际上几秒后就死了，合成出来的 mp3 只有最
开始几段。debug 时还以为是 mmx 限流 / 网络挂了，浪费一上午。

**规则**：

- ❌ **subagent 内不要用** `run_in_background: true` 跑长任务。subagent
  return 时 children 会被收回 —— 没有例外。
- ✅ **subagent 内长任务有两条合法路径**：
  - **路径 A · 同步阻塞 + 拆 chunks**：每个 Bash 调用 ≤ 600s（Claude Code
    Bash timeout 上限 10min），把 batch 拆成多个 chunk 串行同步跑。每个
    chunk 完成后 subagent 拿到结果再启下一个。慢但 100% 可靠。
  - **路径 B · `nohup` + `disown` 脱离会话**：
    ```bash
    nohup bash master.sh </dev/null >/tmp/audio.log 2>&1 & disown
    ```
    进程脱离 subagent 的进程组，绑到 init / launchd 上，subagent 死掉也
    不影响。subagent return 后用户 / 主 agent 再用 `tail -f /tmp/audio.log`
    监控。
- ✅ **主进程（不是 subagent）用 `run_in_background` 是 OK 的**——主进程
  持续存活，子进程不会被回收。但记得最后 monitor / 等结束。

> 这条警告同样适用于"用 subagent 并行做章节生成、subagent 内跑 dev server
> / build / 录屏脚本"等场景 —— 任何**寿命 > subagent 寿命**的子进程都
> 必须用 `nohup + disown` 脱离会话，否则会被静默杀掉。

---

## 文件命名约定

```
presentation/public/audio/
├── coldopen/
│   ├── 1.mp3
│   ├── 2.mp3
│   └── ...
├── hook/
│   └── ...
└── ...
```

- 章节子目录名 = `chapters.ts` 里的 `id`
- 文件名 = `<step-N>.mp3`（**1-indexed**，对齐 narrations 数组的 index + 1）
- 格式默认 mp3。如果 TTS 后端只能出 wav，加一步用 `ffmpeg` 转换

---

## 标准流程

### 1. 抽取 segments

```bash
cd presentation
npm run extract-narrations
```

这会扫所有章节的 `narrations.ts`，按 `chapters.ts` 注册顺序生成
`audio-segments.json`：

```json
[
  { "chapter": "coldopen", "step": 1, "text": "...", "audio": "coldopen/1.mp3" },
  { "chapter": "coldopen", "step": 2, "text": "...", "audio": "coldopen/2.mp3" },
  ...
]
```

让用户**先扫一眼这个 json**，确认文本和切分都对，再开始烧 token 合成。

> **扫 json 时顺带核 TTS 友好文本**（TTS 看字面读音，错了要重合成 + 重录屏）：
>
> - **多音字**补全成词了吗？`调用`不是裸 `调`、`重新`不是裸 `重`
> - **缩写**还原全称了吗？`文本转语音`不是 `t2s`、`大语言模型`不是 `LLM`
> - **单位**换中文词了吗？`1.4 秒`不是 `1.4s`、`200 毫秒`不是 `200ms`
>
> 这三类没清干净，合成出来画外音就是错的。完整规则见
> [`SCRIPT-STYLE.md`](SCRIPT-STYLE.md)「TTS 友好文本」——发现残留就回
> `narrations.ts` 改完再合成，别等烧完 token 才发现读错。

> 空字符串的 narration 会被自动跳过（不烧 TTS token）——运行时 Auto 模式
> 按字数估时撑过这种"无声过场"step。

### 2. 合成

```bash
which mmx
which indextts
```

- 用户明确要本机合成（隐私 / 不联网 / 不烧 token） → 走 [2.C](#2c-indextts-mlx-合成本机)
- mmx 找到 → 走 [2.A](#2a-mmx-cli-合成)
- 都没找到 → 走 [2.B](#2b-退化路径)

#### 2.A mmx-cli 合成

##### 鉴权检查

```bash
mmx auth status
```

未登录 → 提示用户：

```
你的 mmx-cli 未登录。请运行：
  mmx auth login --api-key sk-xxxxx
（API key 在 https://platform.minimaxi.com 获取）
```

登录前**不要继续**。

##### 调用合成脚本

```bash
npm run synthesize-audio              # 增量：跳过已存在的 mp3
npm run synthesize-audio -- --force   # 全部重合成
npm run synthesize-audio -- --voice=<voice-id>  # 指定音色
```

脚本**串行**调 mmx（避免 rate limit），**自动跳过已存在文件**（断点续合
不烧重复 token）。每条打印进度：

```
[  3/24] coldopen/3.mp3   ✓ 4s
[  4/24] coldopen/4.mp3   skip (exists)
```

##### 校验时长

合成完后跑：

```bash
for f in public/audio/*/*.mp3; do
  d=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$f")
  echo "$f  ${d}s"
done
```

把每条的实际秒数汇总告诉用户。**重点关注 ≥ 15s 的条目**——口播太长意味
着该 step 的 narration 写得过密，或者 step 没拆够。让用户决定**改稿子
重合**还是**回章节代码拆 step**。

#### 2.B 退化路径（mmx-cli 没装）

不要假装能合成。问用户：

```
本机没检测到 mmx-cli。我可以：

  1. 帮你安装 MiniMax CLI（推荐）
     需要：npm 全局安装 + 一个 API key
     运行：npm install -g mmx-cli && mmx auth login --api-key sk-xxxxx
     API key 在 https://platform.minimaxi.com 获取

  2. 用其它 TTS（你来提供）
     告诉我用什么 —— OpenAI TTS / 阿里云 / Azure / ElevenLabs / 其它
     最好附上调用方式（CLI 命令 / API endpoint + 参数）
     我会改 scripts/synthesize-audio.sh 让它调你的工具，
     输出文件路径仍按 audio-segments.json 的 audio 字段写

  3. 暂时跳过
     稿子和 narrations 都在，你自己用任意 TTS 录制即可
```

如果用户选 2，按相同的"读 audio-segments.json → 串行调用 → 落盘 →
校验"流程，把 `mmx speech synthesize` 那一行换成对方的命令即可。

#### 2.C IndexTTS-MLX 合成（本机）

适合不想联网 / 不想烧 MiniMax token / 想复用一个固定音色（"音色克隆"）
的场景。原理：先一次性把一段参考音频提取成 `.voice.pt` 特征文件（4-6
MB），之后所有合成调用直接读特征，跳过 librosa + Seamless + CAMPPlus
等前置环节，单次模型加载（~25s）后批量产出。

##### 前置一次性安装

```bash
# 1) 装 indextts CLI
cd /path/to/index-tts-mlx
uv tool install -e .

# 2) 装 ffmpeg（wav → mp3）
brew install ffmpeg

# 3) 生成音色特征文件（每个音色只做一次）
indextts --extract -v reference.mp3 -o my-voice.voice.pt
# 默认音色目录：$INDEXTTS_VOICE_DIR（unset 时 = ~/.webvideo/voices；`./install.sh --voices-from <dir>` 可把已有 .voice.pt 拷进去）
```

broleez 的本地约定：
- `voice-broleez.voice.pt` —— **默认音色（v1.7.1+）**，broleez 本人音色
- `voice-sincere-adult.voice.pt` —— 备选音色，沉稳成年男声（v1.7.0 之前的默认）

##### 调用合成脚本

```bash
npm run synthesize-audio-indextts                          # 默认音色 broleez
npm run synthesize-audio-indextts -- --sincere-adult       # 切换到 sincere-adult 音色
npm run synthesize-audio-indextts -- --broleez             # 显式指定 broleez（与默认等价）
npm run synthesize-audio-indextts -- --force               # 覆盖已存在
npm run synthesize-audio-indextts -- --voice=foo           # 用 $INDEXTTS_VOICE_DIR/foo.voice.pt
INDEXTTS_VOICE_DIR=/path/to/voices npm run synthesize-audio-indextts
```

脚本会把所有 pending 段拼成一个 JSONL 喂给 `indextts --batch`，**模型
只加载一次**（~25s），之后每段几秒。合成产物是 `.wav` → ffmpeg 转
`.mp3` → 旧 wav 自动删，最终落到 `public/audio/<chapter>/<step>.mp3`，
与 mmx 变体的输出位置完全一致，Auto 录屏模式直接可用。

##### 校验时长

同 2.A，跑 ffprobe 汇总每段秒数。

##### 与 mmx 变体的差异

| 维度 | mmx 变体 | IndexTTS-MLX 变体 |
|---|---|---|
| 网络 | 必须联网 | 不需要 |
| Token 烧钱 | 是 | 否 |
| 音色 | mmx voice id | 预提取的 `.voice.pt` 文件 |
| 首段冷启动 | ~2s（API） | ~25s（本机模型加载） |
| 后续每段 | ~3-5s | ~3-8s（看 step 文本长度，本机 MLX） |
| 鉴权 | 需要 API key | 不需要 |

---

## 用户自带 TTS 的最小契约

任何 TTS 后端只要满足三个能力即可接进来：

| 能力 | 输入 | 输出 |
|---|---|---|
| 单段合成 | 一段文字（≤ 5000 字符）+ 音色 id（可选） | 一个 mp3 / wav 文件 |
| 错误反馈 | —— | 失败时明确报错（rate limit / auth / 内容审核 / 网络） |
| 输出可指定路径 | 目标文件路径 | 直接写到该路径 |

不满足"输出可指定路径"的 API（比如返回二进制流）就在外面包一层 curl /
node script 把响应写到目标路径。

---

## 运行时如何使用合成的音频

合成完成后，**不需要任何额外配置**——脚手架的 `App.tsx` 已经接好：

| 模式 | 触发方式 | 行为 |
|---|---|---|
| **Manual**（默认） | 直接打开页面 | 不播音频，点击 / 方向键推进 |
| **Audio**（半自动） | URL `?audio=1` 或按 `M` 键 | 进入 step 自动播音频，但你手动推进（点鼠标） |
| **Auto**（全自动） | URL `?auto=1` 或按两次 `M` 键 | 进入 step 播音频 → 播完自动 next() → 进下个 step → ... |

Auto 模式首次需要按一次 `Space` 启动（绕过浏览器自动播放限制），之后
全自动跑。**录屏时打开屏幕录制 → 按 Space → 整片自动跑完 → stop**。

> **Auto 模式的推进规则就一句话**：每段音频播完 + 200ms 缓冲 → 自动 next。
> **没有"等动画跑完"的兜底**——如果你写的视觉动画比口播长，会被当场切。
> 解决办法：写更长口播 / 拆 step / 调动画速度（详见
> [`CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md) 「代码层最小约束」）。
>
> 音频文件缺失（还没合成 / 404）或 narration 是空串 → 退化到字数估时
> （`max(1500ms, 字数 × 250ms)`），保证预览也能整片跑通。

---

## 故障排查

| 现象 | 原因 / 修法 |
|---|---|
| `chapter id "X" registered but no matching folder found` | 章节文件夹应命名为 `NN-<id>`；id 必须等于 chapters.ts 里注册的 |
| `narrations.ts in X must export an array named "narrations"` | 该章节的 narrations.ts 没 export 名为 narrations 的数组 |
| `mmx: command not found` | `npm install -g mmx-cli`；npm 全局 bin 不在 PATH 时 `npm config get prefix` 看一下 |
| `401 / unauthorized` | `mmx auth login --api-key sk-xxxxx` 重新登录 |
| 中间断了几条没合成 | `npm run synthesize-audio` 重跑 —— 已存在文件会跳过 |
| 中文音色不自然 | mmx 默认音色未必最佳；查 `mmx speech --help` 看 `--voice` 可选项，然后传 `--voice=<id>` |
| 整段合成被截断 | 单段过长（mmx 默认上限约 5000 字符）。在 narrations.ts 里把这条拆成两条（也意味着该 step 应该拆成两个 step） |
| 多音字读错 / 缩写被逐字母拼 / 单位没读出来 | `narrations.ts` 文本没过 TTS 友好三类清洗：多音字补全成词（`调`→`调用`）、缩写还原全称（`t2s`→`文本转语音`）、单位换中文词（`1.4s`→`1.4 秒`）。改 `narrations.ts` 重合成。规则见 [`SCRIPT-STYLE.md`](SCRIPT-STYLE.md)「TTS 友好文本」 |
| 浏览器没播音频 | Auto / Audio 模式下首次需要用户手势——确认你按了 SPACE 启动 Auto，或者点过页面 |
| 音频 404 但 Auto 模式还能跑 | 找不到 mp3 时 useAudioPlayer 退化到字数估时（4 字/秒），保证预览不中断 |

---

## 相关链接

- mmx-cli 仓库：<https://github.com/MiniMax-AI/cli>
- 官方文档：<https://platform.minimaxi.com/docs/token-plan/minimax-cli>
- 参数 / 音色查询：`mmx speech --help`
