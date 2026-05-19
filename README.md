# unarem-pi-prompt

Pi 扩展，用于完全自定义 system prompt — 控制基础 prompt、工具描述、使用指南、技能、上下文等。

## 文件结构

```
unarem-pi-prompt/
├── index.ts                         # 扩展入口
├── package.json
├── tsconfig.json
├── README.md
└── src/
    └── builtin_tools_guidelines.ts  # 工具使用指南
```

## 功能

- 自定义基础 system prompt（身份、沟通风格）
- 重新注册 7 个内置工具，中文 label / description / parameters
- 自动拼接：工具列表 + 使用指南 + 项目上下文 + 技能 + 日期 + 工作目录

## 使用

```bash
# 本地安装
pi install ./.pi/packages/unarem-pi-prompt -l

# 或全局安装
pi install ./.pi/packages/unarem-pi-prompt
```

## 自定义

修改 `index.ts` 中的 `MY_BASE_PROMPT` 常量来自定义基础 prompt。

## 调试

启动 pi 后，使用 `/show-custom-prompt` 命令查看当前 system prompt 的前 1500 个字符。
