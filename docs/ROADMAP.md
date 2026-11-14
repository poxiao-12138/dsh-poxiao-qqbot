# 路线图

## v0.1（当前）
- 渠道级语音（Breeze → sendVoice），凭证复用 QQ_VOICE_POLISH_BREEZE
- 语音模式：voiceOnly / both / text；失败回落文字
- 流式与语音互斥处理

## v0.2 人格选择
- 设置页增加「人格」下拉：读取 agentPresets 列表，保存为全局默认 + per-peer 覆盖
- 可选：内置角色卡目录（roles/*.md）→ 生成 preset 的脚本
- 支持 /persona 命令查看/切换

## v0.3 记忆（已完成 v0.3.0）
- 设置页「记忆」Tab：启用开关、后端选择、Obsidian 路径、scope、topK、字数上限、verified-only、自动提示词规则
- 注册 `memory_search` 工具（agent 主动查），并自动追加“先查记忆”提示词
- 沿用大肥鱼规则：verified 才召回、>6000 字符整篇跳过、索引文件跳过、scope 过滤
- 待办：把自动整理（原 launchd 脚本）并入插件；其他后端（SQLite/远程）

## v0.4 富媒体
- 渠道级表情包：按情绪/概率选图并发送
- 图片理解结果自动语音播报（可选）

## 待评估
- 空间说说（Qzone）：QQ 开放平台未提供
- 主动消息：平台主动推送有额度/场景限制
