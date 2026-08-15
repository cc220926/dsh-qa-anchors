# dsh-qa-anchors

DeepSeek Harness（dsh）Web 端的「对话历史」侧栏插件，参考 DeepSeek 网页版的设计：在聊天区域**右侧**常驻一条细窄的占位横岗，鼠标悬停即展开成对话历史面板，点击任意一轮问答自动滚动跳转到对应位置。

## 快速安装

> 前置：需要本机装了 [pnpm](https://pnpm.io)。没有的话先 `corepack enable pnpm`。

```sh
dsh plugin --profile web add -w github:cc220926/dsh-qa-anchors
```

装完重启 `dsh web`，打开任意一个**有内容的会话**，右侧就会出现这条悬浮横岗。

## 使用

1. 鼠标移到右侧细条上 → 面板展开，列出每一轮问答（带序号 + 问题摘要）；
2. 鼠标悬停在某一项上 → 显示问题全文；
3. 点击某一项 → 平滑滚动到那轮问答的位置；
4. 鼠标移开 → 面板自动收成细条。

## 已知限制

- 锚点覆盖「当前已加载」的消息窗口。长会话的历史较早部分需要先往上滚动（触发加载更多）后，新加载的问答才会进入列表。

## 卸载

```sh
dsh plugin --profile web remove dsh-qa-anchors
```

## 说明

- 走官方 `conversation.session.header.actions` 插槽 + `ctx.sessions` 服务读取会话快照，DOM 锚点用 `[data-chat-anchor-key]` 定位滚动；
- 依赖 dsh 私有扩展点，随 dsh 版本升级可能需适配（当前适配 `0.1.0-rc.6`）。

## License

MIT
