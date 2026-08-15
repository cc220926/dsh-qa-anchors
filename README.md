# dsh-qa-anchors

DeepSeek Harness（dsh）Web 端的「问答锚点」插件：在当前会话的头部加一个「问答」入口，点开列出本轮会话里的每一次问答，鼠标悬停显示问题全文，点击直接滚动跳转到对应的那轮问答。

## 快速安装

> 前置：需要本机装了 [pnpm](https://pnpm.io)。没有的话先 `corepack enable pnpm`。

```sh
dsh plugin --profile web add -w github:cc220926/dsh-qa-anchors
```

装完重启 `dsh web`，打开任意一个**有内容的会话**，会话头部就会出现「问答」按钮。

## 使用

1. 打开一个有对话内容的会话；
2. 点会话头部的「问答」；
3. 面板列出每一轮问答（带序号 + 问题摘要），鼠标悬停显示问题全文；
4. 点击某一项，自动滚动到那轮问答的位置；
5. 点面板外部或再点「问答」关闭。

## 已知限制

- 锚点覆盖「当前已加载」的消息窗口。长会话的历史较早部分需要先往上滚动（触发加载更多）后，新加载的问答才会进入锚点列表。

## 卸载

```sh
dsh plugin --profile web remove dsh-qa-anchors
```

## 说明

- 走官方 `conversation.session.header.actions` 插槽 + `ctx.sessions` 服务读取会话快照，DOM 锚点用 `[data-chat-anchor-key]` 定位滚动；
- 依赖 dsh 私有扩展点，随 dsh 版本升级可能需适配（当前适配 `0.1.0-rc.6`）。

## License

MIT
