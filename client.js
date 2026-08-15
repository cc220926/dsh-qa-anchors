window.__ModuleLoader__.load({
  id: "dsh-qa-anchors",
  factory: (require) => {
    const jsx = require("react/jsx-runtime").jsx;
    const jsxs = require("react/jsx-runtime").jsxs;
    const React = require("react");
    const { useState, useMemo, useEffect, useRef, useSyncExternalStore } = React;

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
.dqa-wrap { position: relative; }
.dqa-trigger { border: none; background: transparent; cursor: pointer; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 13px; padding: 5px 10px; border-radius: 8px; white-space: nowrap; }
.dqa-trigger:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); }
.dqa-trigger.open { color: var(--dsw-alias-brand-primary); }
.dqa-panel { position: absolute; top: calc(100% + 6px); right: 0; z-index: 1200; width: 340px; max-width: 80vw; max-height: 56vh; display: flex; flex-direction: column; background: var(--dsw-alias-bg-overlay, #fff); border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,0.28); overflow: hidden; }
.dqa-head { padding: 8px 12px; border-bottom: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.dqa-list { overflow-y: auto; padding: 4px; }
.dqa-item { box-sizing: border-box; display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; border: none; border-radius: 8px; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; cursor: pointer; text-align: left; }
.dqa-item:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dqa-num { flex: none; min-width: 20px; text-align: right; color: var(--dsw-alias-label-tertiary); font-size: 11px; }
.dqa-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dqa-empty { padding: 18px; text-align: center; color: var(--dsw-alias-label-tertiary); font-size: 13px; }
`;

    // ── 组件：会话头部按钮 + 问答锚点下拉 ─────────────────────────────
    function AnchorButton({ sessionId, sessions }) {
      const [open, setOpen] = useState(false);
      const wrapRef = useRef(null);
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

      useEffect(() => {
        if (!open) return;
        const onDown = (e) => {
          if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
      }, [open]);

      const jump = (key) => {
        const el = findAnchor(key);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        setOpen(false);
      };

      return jsxs("div", { ref: wrapRef, className: "dqa-wrap", children: [
        jsx("button", {
          type: "button",
          className: "dqa-trigger" + (open ? " open" : ""),
          onClick: () => setOpen(v => !v),
          "aria-expanded": open,
          "aria-haspopup": "listbox",
          title: "问答锚点",
          children: "问答"
        }),
        open ? jsxs("div", { className: "dqa-panel", children: [
          jsx("div", { className: "dqa-head", children: anchors.length ? `共 ${anchors.length} 轮问答，点击跳转` : "问答锚点" }),
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
        ] }) : null
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
