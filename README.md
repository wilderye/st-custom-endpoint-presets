[English](./README_EN.md) | **中文**

# ST 自定义端点预设

> 轻量级 SillyTavern 端点书签管理器，专为「自定义（兼容 OpenAI）」API 来源设计。

## 为什么需要这个脚本？

SillyTavern 已有 **Connection Manager（API 连接配置）** 用于切换 API 设置。但它保存的是*所有内容*——URL、模型、预设、API 来源等 20+ 项设置。对很多用户来说，只需要在几个 **URL + API Key + 模型名** 之间快速切换。

这个脚本只做这一件事：

| | Connection Manager | 本脚本 |
|---|---|---|
| 保存范围 | 完整环境快照（20+ 项设置） | 仅 URL + API Key + 模型名 |
| 复杂度 | 基于 Profile，按钮和选项众多 | 一个下拉框，四个按钮 |
| 适用场景 | "我要切换完全不同的环境" | "我只是想换个 API 地址" |

两者可以共存——如果 Connection Manager 切换了设置，本脚本的下拉框会自动重置为「无」，避免冲突。

## 前置要求

- [SillyTavern](https://github.com/SillyTavern/SillyTavern) ≥ **1.13.0**
- [酒馆助手](https://n0vi028.github.io/JS-Slash-Runner-Doc/guide/%E5%85%B3%E4%BA%8E%E9%85%92%E9%A6%86%E5%8A%A9%E6%89%8B/%E5%AE%89%E8%A3%85%E4%B8%8E%E6%9B%B4%E6%96%B0.html)

## 安装

1. 打开 SillyTavern → 酒馆助手 → 脚本库
2. 新建一个**全局脚本**
3. 在脚本内容中粘贴：

```
import 'https://testingcf.jsdelivr.net/gh/wilderye/st-custom-endpoint-presets/dist/custom-endpoint-bookmarks/index.js'
```

4. 启用脚本

## 使用

1. 进入 **API** → **聊天补全** → 选择**自定义（兼容 OpenAI）**
2. 照常填入 URL、API Key、模型名
3. 点击 **➕** 保存为命名预设
4. 通过**下拉框**在已保存的预设间切换
5. **💾** 用当前设置覆盖所选预设
6. **✏️** 改名，**🗑️** 删除

Connection Manager 旁边的**勾选框**（"切换预设不切换API设置"）可以防止切换聊天补全预设时连带覆盖你的 API 连接设置。
