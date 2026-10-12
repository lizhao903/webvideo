import type { CoverDef } from "./types";

import HookQuestion from "./01-hook-question/HookQuestion";
import HookStatement from "./02-hook-statement/HookStatement";
import HookNumbers from "./03-hook-numbers/HookNumbers";
import VsContrast from "./04-vs-contrast/VsContrast";
import HeroSkill from "./05-hero-skill/HeroSkill";

/**
 * Cover 注册表 —— Playwright render-covers.mjs 读这个文件抽 id 列表，
 * App.tsx 的 CoverMode() 按 URL ?cover=<id> 查找渲染。
 *
 * 复用本模板时：
 *   1. 5 个变体 import 路径**不要动** —— 文件夹名固化为 01-hook-question
 *      / 02-hook-statement / 03-hook-numbers / 04-vs-contrast / 05-hero-skill
 *   2. 每条的 variant + hypothesis 是 A/B 测试用的**项目专属描述**，
 *      请按本项目实际钩子改写
 *   3. 如果某个变体不适合本项目主题（如纯案例视频用不到 03-hook-numbers），
 *      可以删掉对应 import + 数组项。AB 跑 3-5 张都行，但**不要 < 3**
 */
export const COVERS: CoverDef[] = [
  {
    id: "01-hook-question",
    variant: "{{V1_VARIANT}}",
    hypothesis: "{{V1_HYPOTHESIS}}",
    Component: HookQuestion,
  },
  {
    id: "02-hook-statement",
    variant: "{{V2_VARIANT}}",
    hypothesis: "{{V2_HYPOTHESIS}}",
    Component: HookStatement,
  },
  {
    id: "03-hook-numbers",
    variant: "{{V3_VARIANT}}",
    hypothesis: "{{V3_HYPOTHESIS}}",
    Component: HookNumbers,
  },
  {
    id: "04-vs-contrast",
    variant: "{{V4_VARIANT}}",
    hypothesis: "{{V4_HYPOTHESIS}}",
    Component: VsContrast,
  },
  {
    id: "05-hero-skill",
    variant: "{{V5_VARIANT}}",
    hypothesis: "{{V5_HYPOTHESIS}}",
    Component: HeroSkill,
  },
];
