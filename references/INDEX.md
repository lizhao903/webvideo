<!-- 由 scripts/gen-index.mjs 自动生成，勿手改；改 references/ 后重跑脚本。-->

# References 索引

`references/` 下每个文件的一行用途 + 「何时读」，让 agent 不通读就能定位。
等价的机器可读扁平版见仓库根 [`llms.txt`](../llms.txt)。

| 文件 | 标题 | 何时读 | 用途 |
|---|---|---|---|
| [`references/AUDIO.md`](AUDIO.md) | 音频合成 | Phase 3 音频合成时才读 | MiniMax/indextts CLI、narrations→segments→mmx 流程、subagent 长任务严禁 run_in_background、合成前核 TTS 友好文本 |
| [`references/CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md) | 章节开发指引（每章开发必读） | Phase 2.4 实现单章 · 每章单一必读入口（×N 次） | 十条原则 / 开工5问 / 关系→动作决策树 / 视觉工具箱 / 手机字号阈值 / 反AI味 / 代码红线 / 完工自检 |
| [`references/COVER.md`](COVER.md) | 视频分发包 · 封面 AB + 简介 + 章节标记 | Phase 5 分发包 · 单一必读入口 | 5变体AB策略 / 单变量原则 / 反AI味 / 渲染流程 / description 4段式 / chapters.md 格式 / 中文流量打法 |
| `references/EXAMPLES/` | EXAMPLES/ | 可选 —— 卡壳时翻「形」，不是抄袭模板 | 章节结构示意：hook-chapter / list-reveal / case-tech-review |
| [`references/OUTLINE-FORMAT.md`](OUTLINE-FORMAT.md) | `outline.md` 格式 spec | Phase 1.2 内容编写 · 必读 | outline.md 字段 spec、章节/step 切分、章节首段「信息池」、素材清单格式 |
| [`references/RECORDING.md`](RECORDING.md) | 录制与后期合成 | Phase 4 录屏+后期时才读 | 程序化渲染 render-video / Auto 模式 ?auto=1 一镜到底 / 手动录屏三路径 + 后期工具 |
| [`references/SCRIPT-STYLE.md`](SCRIPT-STYLE.md) | 文章 → 口播稿风格指南 | Phase 1.2 内容编写 · 必读 | 文章→B站风口播稿规则、去AI味五类、TTS友好文本三类清洗、按 orientation 调节奏 |
| [`references/SERIES-BATCH.md`](SERIES-BATCH.md) | 系列批量改版 —— 给已完成系列的所有集数做统一结构调整 | — | 系列批量改版 —— 给已完成系列的所有集数做统一结构调整 |
| [`references/THEMES.md`](THEMES.md) | 主题系统 | Checkpoint Plan 选主题 / 造主题 / 切主题时 | 完整 token 契约 + 内置主题清单 + 创作新主题流程 + font-size token 建议 |

## 离线 docs 查询

不想开文件读全文时，把某主题的关键段落抓到终端：

```bash
node scripts/docs.mjs --list          # 列所有 topic → 文件映射
node scripts/docs.mjs chapter         # 打印 CHAPTER-CRAFT.md 的开头/原则段
node scripts/docs.mjs cover           # 打印 COVER.md 的关键段
```
