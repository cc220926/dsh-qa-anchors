window.__ModuleLoader__.load({
  id: "dsh-qa-anchors",
  factory: (require) => {
    const jsx = require("react/jsx-runtime").jsx;
    const jsxs = require("react/jsx-runtime").jsxs;
    const React = require("react");
    const { useState, useMemo, useSyncExternalStore } = React;

    // ── 工具 ──────────────────────────────────────────────────────────
    function textOf(content) {
      return (content || [])
        .map(b => (b && b.type === "text" ? String(b.text || "") : ""))
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    }

    // 从会话快照构建问答锚点：每项 {key, text}
    function buildAnchors(snapshot) {
      if (!snapshot || !snapshot.chat) return [];
      const bySeq = {};
      for (const n of snapshot.nodes || []) {
        if (n.kind === "user") bySeq[n.seq] = n;
      }
      const out = [];
      for (const key of (snapshot.chat.order || [])) {
        const vn = snapshot.chat.nodes.get(key);
        if (!vn || vn.kind !== "user") continue;
        const raw = bySeq[vn.anchorSeq];
        out.push({ key, text: raw ? textOf(raw.content) : "" });
      }
      return out;
    }

    function findAnchor(key) {
      for (const el of document.querySelectorAll("[data-chat-anchor-key]")) {
        if (el.dataset.chatAnchorKey === key) return el;
      }
      return null;
    }

    // ── 样式 ──────────────────────────────────────────────────────────
    const BASE_CSS = `
/* 外层 hover 容器：右侧窄条热区（40px），统一控制展开/收缩 */
.history-hover-zone { position: fixed; top: 0; right: 0; bottom: 0; width: 40px; z-index: 1100; }
/* 收缩态：一列短横条（每条历史对应一根） */
.history-bars { position: absolute; right: 15px; top: 0; bottom: 0; width: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; box-sizing: border-box; overflow: hidden; transition: opacity 0.2s ease; }
.history-bar { flex: none; width: 16px; height: 3px; border-radius: 2px; background: var(--dsw-alias-label-tertiary); }
.history-bar.current { background: var(--dsw-alias-state-business-primary); }
/* 展开态：完整面板（从右向左滑入，覆盖显示，不挤压主内容） */
.history-panel { position: absolute; right: 0; top: 0; bottom: 0; width: 300px; max-width: calc(100vw - 56px); display: flex; flex-direction: column; background: var(--dsw-alias-bg-overlay, #fff); border-left: 1px solid var(--dsw-alias-border-l2); box-shadow: -12px 0 32px rgba(0,0,0,0.2); opacity: 0; transform: translateX(100%); pointer-events: none; transition: opacity 0.22s ease, transform 0.22s ease; }
.history-hover-zone:hover .history-bars { opacity: 0; }
.history-hover-zone:hover .history-panel { opacity: 1; transform: translateX(0); pointer-events: auto; }
/* 面板内容 */
.history-head { display: flex; align-items: center; padding: 12px 14px; border-bottom: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 20px; white-space: nowrap; }
.history-list { overflow-y: auto; overflow-x: hidden; padding: 6px; flex: 1; }
.history-list::-webkit-scrollbar { width: 6px; }
.history-list::-webkit-scrollbar-thumb { background: var(--dsw-alias-border-l2); border-radius: 3px; }
.history-list::-webkit-scrollbar-track { background: transparent; }
.history-item { box-sizing: border-box; display: flex; align-items: flex-start; gap: 8px; width: 100%; padding: 8px 10px; border: none; border-radius: 8px; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; line-height: 20px; cursor: pointer; text-align: left; }
.history-title { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.history-item:hover .history-title { white-space: normal; overflow: visible; text-overflow: clip; overflow-wrap: anywhere; }
.history-mark { flex-shrink: 0; align-self: center; width: 14px; height: 3px; border-radius: 2px; background: var(--dsw-alias-label-tertiary); }
.history-item:hover .history-mark { background: var(--dsw-alias-label-primary); }
.history-item.active { background: var(--dsw-alias-interactive-bg-hover); }
.history-item.active .history-title { color: var(--dsw-alias-state-business-primary); }
.history-item.active .history-mark { background: var(--dsw-alias-state-business-primary); }
.history-empty { padding: 18px; text-align: center; color: var(--dsw-alias-label-tertiary); font-size: 13px; }
`;

    // ── 组件：右侧历史会话面板（默认收缩为一列横条，悬停展开）────────
    function AnchorButton({ sessionId, sessions }) {
      const snapshot = useSyncExternalStore(
        (fn) => {
          const s = sessionId ? sessions?.binding(sessionId)?.session : undefined;
          return s ? s.subscribe(fn) : () => {};
        },
        () => {
          const s = sessionId ? sessions?.binding(sessionId)?.session : undefined;
          return s ? s.getSnapshot() : undefined;
        }
      );
      const anchors = useMemo(() => buildAnchors(snapshot), [snapshot]);
      const [activeKey, setActiveKey] = useState(null);
      // 当前项：默认最后一条（最近一轮），点击后变为被点击项
      const currentKey = activeKey || (anchors.length ? anchors[anchors.length - 1].key : null);

      const jump = (key) => {
        setActiveKey(key);
        const el = findAnchor(key);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      };

      return jsxs("div", { className: "history-hover-zone", children: [
        jsx("div", { className: "history-bars", "aria-hidden": "true", children: anchors.map((a) =>
          jsx("span", { key: "bar-" + a.key, className: "history-bar" + (a.key === currentKey ? " current" : "") })
        ) }),
        jsxs("aside", { className: "history-panel", children: [
          jsx("div", { className: "history-head", children: anchors.length ? `对话历史（${anchors.length}）` : "对话历史" }),
          jsx("div", { className: "history-list", children: anchors.length
            ? anchors.map((a) => jsxs("button", {
                key: a.key,
                type: "button",
                className: "history-item" + (a.key === currentKey ? " active" : ""),
                onClick: () => jump(a.key),
                children: [
                  jsx("span", { className: "history-title", children: a.text || "（无文本）" }),
                  jsx("span", { className: "history-mark", "aria-hidden": "true" })
                ]
              }))
            : jsx("div", { className: "history-empty", children: "暂无问答" })
          })
        ] })
      ] });
    }

    // ── apply ──────────────────────────────────────────────────────────
    const inject = ["slots"];

    function apply(ctx) {
      if (typeof document === "undefined") return;

      const styleTag = document.createElement("style");
      styleTag.dataset.plugin = "dsh-qa-anchors";
      styleTag.textContent = BASE_CSS;
      document.head.appendChild(styleTag);

      ctx.inject(["slots", "conversation", "sessions"], (scope) => {
        scope.effect(() => {
          const dispose = scope.slots.register({
            name: "conversation.session.header.actions", id: "qa-anchors", order: 10,
            inject: () => ({ sessions: scope.sessions })
          }, AnchorButton);
          return () => { dispose(); };
        }, "dsh-qa-anchors: header action");
      });

      ctx.effect(() => () => { styleTag.remove(); }, "dsh-qa-anchors: cleanup");
    }

    return { apply, inject };
  }
});
