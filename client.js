window.__ModuleLoader__.load({
  id: "dsh-qa-anchors",
  factory: (require) => {
    const jsx = require("react/jsx-runtime").jsx;
    const jsxs = require("react/jsx-runtime").jsxs;
    const React = require("react");
    const { useMemo, useSyncExternalStore } = React;

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
.dqa-rail { position: fixed; top: 0; right: 0; bottom: 0; z-index: 1100; width: 16px; background: var(--dsw-alias-bg-overlay, #fff); border-left: 1px solid var(--dsw-alias-border-l2); overflow: hidden; transition: width 0.2s ease; }
.dqa-rail::before { content: ""; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 4px; height: 44px; border-radius: 4px; background: var(--dsw-alias-border-l2); transition: opacity 0.15s; }
.dqa-rail:hover { width: 300px; box-shadow: -12px 0 32px rgba(0,0,0,0.18); }
.dqa-rail:hover::before { opacity: 0; }
.dqa-rail-panel { display: flex; flex-direction: column; height: 100%; width: 300px; opacity: 0; pointer-events: none; transition: opacity 0.15s; }
.dqa-rail:hover .dqa-rail-panel { opacity: 1; pointer-events: auto; }
.dqa-rail-head { display: flex; align-items: center; padding: 12px 14px; border-bottom: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 20px; white-space: nowrap; }
.dqa-list { overflow-y: auto; padding: 6px; flex: 1; }
.dqa-item { box-sizing: border-box; display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; border: none; border-radius: 8px; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; cursor: pointer; text-align: left; }
.dqa-item:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dqa-num { flex: none; min-width: 20px; text-align: right; color: var(--dsw-alias-label-tertiary); font-size: 11px; }
.dqa-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dqa-empty { padding: 18px; text-align: center; color: var(--dsw-alias-label-tertiary); font-size: 13px; }
`;

    // ── 组件：右侧悬浮历史 rail（收起为占位横岗，悬停展开）────────────
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

      const jump = (key) => {
        const el = findAnchor(key);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      };

      return jsxs("div", { className: "dqa-rail", children: [
        jsxs("div", { className: "dqa-rail-panel", children: [
          jsx("div", { className: "dqa-rail-head", children: anchors.length ? `对话历史（${anchors.length}）` : "对话历史" }),
          jsx("div", { className: "dqa-list", children: anchors.length
            ? anchors.map((a, i) => jsxs("button", {
                key: a.key,
                type: "button",
                className: "dqa-item",
                title: a.text || "（无文本）",
                onClick: () => jump(a.key),
                children: [
                  jsx("span", { className: "dqa-num", children: String(i + 1) }),
                  jsx("span", { className: "dqa-text", children: a.text || "（无文本）" })
                ]
              }))
            : jsx("div", { className: "dqa-empty", children: "暂无问答" })
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
