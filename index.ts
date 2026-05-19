/**
 * unarem-pi-prompt — Pi coding agent extension.
 *
 * 完全自定义 system prompt：控制基础 prompt、工具描述、使用指南、技能、上下文等。
 *
 * 功能
 * ────
 * before_agent_start → 拼接自定义 system prompt（基础 prompt + 工具列表 + 指南 + 上下文 + 技能）
 *
 * 工具
 * ────
 * 重新注册 7 个内置工具，替换为中文 label / description / parameters
 *
 * 命令
 * ────
 *   /show-custom-prompt → 查看当前 system prompt 前 1500 字符
 */

import type { BuildSystemPromptOptions, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  createReadToolDefinition,
  createBashToolDefinition,
  createEditToolDefinition,
  createWriteToolDefinition,
  createGrepToolDefinition,
  createFindToolDefinition,
  createLsToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { GUIDELINES } from "./src/builtin_tools_guidelines.js";

// ── 自定义基础 Prompt ──────────────────────────────────────────────────────────

const MY_BASE_PROMPT = `你是一位运行于 pi（一个代码代理框架）内部的专业编程助手。你通过读取文件、执行命令、编辑代码以及编写新文件来协助用户。

## 身份特质
- 你能编写整洁、可用于生产环境的代码
- 你遵循 SOLID 原则及整洁架构（Clean Architecture）
- 你总是会考虑到边缘情况及错误处理

## 沟通方式
- 表达直接，提供可执行的建议
- 在解释说明时，辅以代码示例
- 若有不确定之处，请如实告知，切勿凭空臆测`;

// ── 工具注册 ───────────────────────────────────────────────────────────────────

interface ToolConfig {
  label: string;
  description: string;
  promptSnippet: string;
  promptGuidelines: string[];
  parameters: any;
}

function registerTool(pi: ExtensionAPI, def: any, cfg: ToolConfig) {
  pi.registerTool({
    name: def.name,
    execute: def.execute,
    renderCall: def.renderCall,
    renderResult: def.renderResult,
    ...cfg,
  });
}

function registerAllTools(pi: ExtensionAPI) {
  const cwd = process.cwd();

  const tools: Array<{ def: any; cfg: ToolConfig }> = [
    {
      def: createReadToolDefinition(cwd),
      cfg: {
        label: "读取文件",
        description:
          "读取文件的内容。支持文本文件及图片（jpg、png、gif、webp）格式。图片将作为附件发送。对于文本文件，输出内容将被截断至 2000 行或 50KB（以先达到的限制为准）。处理大型文件时，请使用 `offset` 和 `limit` 参数。",
        promptSnippet: "读取文件内容 (文本和图片)",
        promptGuidelines: [
          "使用 read 工具来检查文件，而不是 cat 或 head",
          "对于大文件，使用 offset 和 limit 来分块读取",
        ],
        parameters: Type.Object({
          path: Type.String({ description: "要读取的文件路径（相对或绝对路径）" }),
          offset: Type.Optional(Type.Number({ description: "起始行号（从 1 开始）" })),
          limit: Type.Optional(Type.Number({ description: "最大读取行数" })),
        }),
      },
    },
    {
      def: createBashToolDefinition(cwd),
      cfg: {
        label: "执行 Bash 命令",
        description:
          "在当前工作目录下执行 Bash 命令。返回标准输出和标准错误。输出将被截断至最后 2000 行或 50KB（以先达到的限制为准）。如果内容被截断，完整输出将被保存到一个临时文件中。可选择性地提供以秒为单位的超时时间。",
        promptSnippet: "在当前目录中运行 Bash 命令",
        promptGuidelines: [
          "仅在无法使用更具针对性的内置工具（如 ls、find、grep 等）时才使用 bash 工具",
          "避免使用耗时过长或需要持续交互的命令",
        ],
        parameters: Type.Object({
          command: Type.String({ description: "要执行的 Bash 命令" }),
          timeout: Type.Optional(Type.Number({ description: "超时时间，单位为秒（可选，默认无超时）" })),
        }),
      },
    },
    {
      def: createEditToolDefinition(cwd),
      cfg: {
        label: "编辑文件",
        description:
          "使用精确的文本替换来编辑单个文件。每个 edits[].oldText 必须精确匹配原文件中唯一且不重叠的区域。如果两个修改影响同一个区块或相邻的行，请将它们合并为一个编辑。",
        promptSnippet: "通过精确的文本替换编辑文件",
        promptGuidelines: [
          "确保 oldText 在目标文件中是唯一的",
          "如果修改区域相邻或重叠，请将其合并为单个 edit 块",
        ],
        parameters: Type.Object({
          path: Type.String({ description: "要编辑的文件路径（相对或绝对路径）" }),
          edits: Type.Array(
            Type.Object({
              oldText: Type.String({ description: "用于一次目标替换的精确原始文本" }),
              newText: Type.String({ description: "此目标编辑的替换文本" }),
            }),
            { description: "一个或多个目标替换" }
          ),
        }),
      },
    },
    {
      def: createWriteToolDefinition(cwd),
      cfg: {
        label: "写入文件",
        description:
          "将内容写入文件。如果文件不存在则自动创建，如果已存在则直接覆盖。会自动创建不存在的父级目录。",
        promptSnippet: "创建或完全覆盖写入文件内容",
        promptGuidelines: [
          "用于创建新文件或完全覆盖现有文件。若只需局部修改，请优先使用 edit 工具",
        ],
        parameters: Type.Object({
          path: Type.String({ description: "要写入的文件路径（相对或绝对路径）" }),
          content: Type.String({ description: "要写入文件的内容" }),
        }),
      },
    },
    {
      def: createGrepToolDefinition(cwd),
      cfg: {
        label: "搜索文本内容",
        description:
          "在文件内容中搜索指定模式。返回匹配的行、文件路径和行号。遵守 .gitignore 规则。输出最多截断至 100 个匹配项或 50KB。",
        promptSnippet: "在文件中搜索文本模式 (Regex 或字面量)",
        promptGuidelines: [
          "使用此工具来快速查找包含特定类、函数或变量定义的文件",
          "可以通过设置 limit 限制搜索结果数量",
        ],
        parameters: Type.Object({
          pattern: Type.String({ description: "搜索模式（正则表达式或字面量字符串）" }),
          path: Type.Optional(Type.String({ description: "要搜索的目录或文件路径（默认：当前工作目录）" })),
          glob: Type.Optional(Type.String({ description: "通过 glob 模式过滤文件，例如 '*.ts'" })),
          ignoreCase: Type.Optional(Type.Boolean({ description: "是否忽略大小写（默认：false）" })),
          literal: Type.Optional(Type.Boolean({ description: "将模式视为字面量字符串（默认：false）" })),
          context: Type.Optional(Type.Number({ description: "每个匹配项前后显示的上下文行数（默认：0）" })),
          limit: Type.Optional(Type.Number({ description: "最大匹配结果数（默认：100）" })),
        }),
      },
    },
    {
      def: createFindToolDefinition(cwd),
      cfg: {
        label: "查找文件",
        description:
          "通过 glob 模式搜索匹配的文件。返回相对于搜索目录的文件路径。遵守 .gitignore 规则。输出最多截断至 1000 个匹配结果。",
        promptSnippet: "按文件名或 glob 模式搜索文件",
        promptGuidelines: [
          "当需要定位特定名称、扩展名或路径结构的文件时，请使用此工具",
        ],
        parameters: Type.Object({
          pattern: Type.String({ description: "用于匹配文件的 glob 模式" }),
          path: Type.Optional(Type.String({ description: "起始目录（默认：当前工作目录）" })),
          limit: Type.Optional(Type.Number({ description: "最大返回结果数量（默认：1000）" })),
        }),
      },
    },
    {
      def: createLsToolDefinition(cwd),
      cfg: {
        label: "列出目录内容",
        description:
          "列出指定目录下的子文件与子目录。返回结果按字母顺序排序，目录条目附加 '/' 后缀。包含隐藏文件。输出最多截断至 500 个条目。",
        promptSnippet: "获取指定目录下的文件和文件夹列表",
        promptGuidelines: [
          "在执行具体的读写操作前，先使用 ls 工具来了解目录结构",
        ],
        parameters: Type.Object({
          path: Type.Optional(Type.String({ description: "要列出的目录路径（默认：当前工作目录）" })),
          limit: Type.Optional(Type.Number({ description: "最大返回条目数（默认：500）" })),
        }),
      },
    },
  ];

  for (const { def, cfg } of tools) {
    registerTool(pi, def, cfg);
  }
}

// ── 辅助函数 ───────────────────────────────────────────────────────────────────

function formatTools(opts: BuildSystemPromptOptions): string {
  if (!opts.selectedTools || !opts.toolSnippets) return "";
  return opts.selectedTools
    .filter((n) => !!opts.toolSnippets?.[n])
    .map((n) => `- ${n}: ${opts.toolSnippets![n]}`)
    .join("\n");
}

function formatSkills(opts: BuildSystemPromptOptions): string {
  if (!opts.skills?.length) return "";
  const xml = opts.skills
    .filter((s) => !s.disableModelInvocation)
    .map(
      (s) =>
        `  <技能>\n    <名字>${s.name}</名字>\n    <说明>${s.description}</说明>\n    <文件路径>${s.filePath}</文件路径>\n  </技能>`
    )
    .join("\n");
  return xml
    ? `\n以下技能提供专门的指导。\n使用读取工具加载与任务匹配的技能。\n\n<可用技能>\n${xml}\n</可用技能>`
    : "";
}

function formatContext(opts: BuildSystemPromptOptions): string {
  if (!opts.contextFiles?.length) return "";
  let result = "\n\n# 项目上下文\n\n";
  for (const f of opts.contextFiles) {
    result += `## ${f.path}\n\n${f.content}\n\n`;
  }
  return result;
}

// ── 扩展入口 ───────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  registerAllTools(pi);

  pi.on("before_agent_start", async (event) => {
    const { systemPromptOptions: opts } = event;

    const toolsList = formatTools(opts);
    const skills = formatSkills(opts);
    const context = formatContext(opts);
    const append = opts.appendSystemPrompt
      ? `\n\n${opts.appendSystemPrompt.replace(/\r\n/g, "\n").replace(/\n+$/, "")}`
      : "";

    const finalPrompt = [
      MY_BASE_PROMPT,
      toolsList ? `\n\n可用工具:\n${toolsList}` : "",
      `\n\n# 指导手册\n\n${GUIDELINES}`,
      append,
      context,
      skills,
      `\n\n当前日期: ${new Date().toISOString().split("T")[0]}`,
      `\n当前工作目录: ${opts.cwd?.replace(/\\/g, "/") ?? "未知"}`,
    ].join("");

    return { systemPrompt: finalPrompt };
  });

  pi.registerCommand("show-custom-prompt", {
    description: "展示当前 system prompt（仅前 1500 字符）",
    handler: async (_args, ctx) => {
      const p = ctx.getSystemPrompt();
      ctx.ui.notify(`[${p.length} chars]\n${p.slice(0, 1500)}...`, "info");
    },
  });
}
