window.__ModuleLoader__.load({
  id: "dsh-qa-anchors",
  factory: (require) => {
    const jsx = require("react/jsx-runtime").jsx;
    const jsxs = require("react/jsx-runtime").jsxs;
    const React = require("react");
    const { useState, useEffect, useSyncExternalStore } = React;
    const { createPortal } = require("react-dom");

    // ── 样式（我们的：横条 + 蓝色当前，干净）────────────────────────
    const CSS = `
.dqa-rail { position: fixed; z-index: 900; width: 16px; display: flex; flex-direction: column; box-sizing: border-box; }
.dqa-bar { position: relative; flex: none; width: 16px; height: 3px; border-radius: 2px; border: none; padding: 0; cursor: pointer; background: var(--dsw-alias-label-tertiary); transition: transform 0.12s ease, background 0.12s ease; }
.dqa-bar:hover, .dqa-bar:focus-visible { transform: scaleX(1.6); background: var(--dsw-alias-label-primary); }
.dqa-bar.active { background: var(--dsw-alias-state-business-primary); }
.dqa-card { position: fixed; z-index: 950; width: min(300px, calc(100vw - 16px)); max-height: 200px; display: flex; flex-direction: column; background: var(--dsw-alias-bg-overlay, #fff); border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,0.28); pointer-events: none; overflow: hidden; }
.dqa-card-head { flex: none; padding: 6px 12px; border-bottom: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 16px; }
.dqa-card-text { padding: 10px 13px; color: var(--dsw-alias-label-primary); font-size: 12px; line-height: 18px; white-space: pre-wrap; overflow-wrap: anywhere; overflow-y: auto; }
.dqa-flash { animation: dqaFlash 1.2s ease-out; }
@keyframes dqaFlash { 0%,100% { background-color: transparent; } 35% { background-color: var(--dsw-alias-state-business-primary); } }
`;

    // ── 数据 ──────────────────────────────────────────────────────────
    function userTextOf(content) {
      if (!Array.isArray(content)) return "";
      let out = "";
      for (const b of content) {
        if (b && typeof b === "object" && b.type === "text" && typeof b.text === "string") out += b.text;
      }
      return out.trim();
    }

    // 从已加载的 chat 节点收集用户消息
    function collectFromNodes(snapshot) {
      const out = [];
      if (!snapshot || !snapshot.chat) return out;
      for (const node of snapshot.chat.nodes.values()) {
        if (!node || node.kind !== "user") continue;
        const data = node.data;
        if (!data || typeof data.time !== "number" || !Array.isArray(data.content)) continue;
        const key = typeof node.key === "string" ? node.key : "";
        if (!key) continue;
        out.push({ seq: node.anchorSeq, time: data.time, text: userTextOf(data.content), key });
      }
      out.sort((a, b) => a.seq - b.seq);
      return out;
    }

    // 找到 key 对应的聊天行 DOM
    function findAnchor(key) {
      for (const el of document.querySelectorAll("[data-chat-anchor-key]")) {
        if (el.dataset.chatAnchorKey === key) return el;
      }
      return null;
    }

    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    // 确保消息在已加载窗口内，然后居中跳转 + 闪烁
    async function jumpToMessage(sessions, sessionId, key) {
      const session = sessions.binding(sessionId)?.session;
      if (!session) return;
      let guard = 0;
      while (guard++ < 120) {
        const snap = session.getSnapshot();
        if (snap?.chat?.nodes?.get(key) !== undefined) break;
        if (snap?.hasMore !== true) return;
        if (snap.loadingOlder === true) { await delay(50); continue; }
        await session.loadOlder();
      }
      const row = findAnchor(key);
      if (!row) return;
      const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      row.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      row.classList.add("dqa-flash");
      setTimeout(() => row.classList.remove("dqa-flash"), 1400);
    }

    // 自适应间距：让横条铺满可用高度（数量多时间距收缩）
    function layoutBars(n, height) {
      if (n <= 0) return { bar: 3, gap: 8 };
      const pad = 14;
      const usable = Math.max(1, height - pad * 2);
      const bar = n > 60 ? 2 : 3;
      const gap = n > 1 ? Math.max(2, (usable - n * bar) / (n - 1)) : 0;
      return { bar, gap };
    }

    function fmtClock(ms) {
      const d = new Date(ms);
      const p = (n) => String(n).padStart(2, "0");
      return (d.getMonth() + 1) + "/" + d.getDate() + " " + p(d.getHours()) + ":" + p(d.getMinutes());
    }

    // ── 悬停预览卡片 ──────────────────────────────────────────────────
    function PreviewCard({ message, index, total, railLeft }) {
      const left = Math.max(8, railLeft - 300 - 12);
      const top = Math.max(8, window.innerHeight / 2 - 100);
      return jsxs("div", { className: "dqa-card", style: { left, top }, children: [
        jsx("div", { className: "dqa-card-head", children: index + " / " + total + " · " + fmtClock(message.time) }),
        message.text ? jsx("div", { className: "dqa-card-text", children: message.text.slice(0, 500) }) : jsx("div", { className: "dqa-card-text", children: "（无文本内容）" })
      ] });
    }

    // ── 主组件：右侧横条导航 rail ─────────────────────────────────────
    function MessageRail({ sessionId, sessions }) {
      const session = sessionId ? sessions?.binding(sessionId)?.session : undefined;
      const snapshot = useSyncExternalStore(
        (cb) => (session ? session.subscribe(cb) : () => {}),
        () => (session ? session.getSnapshot() : undefined)
      );
      const messages = collectFromNodes(snapshot);

      const [railRect, setRailRect] = useState(null);
      const [hover, setHover] = useState(null);
      const [activeIndex, setActiveIndex] = useState(-1);

      // 后台 loadOlder 加载完整历史
      useEffect(() => {
        if (!session) return;
        let cancelled = false;
        const run = async () => {
          let guard = 0;
          while (!cancelled && guard++ < 120) {
            const snap = session.getSnapshot();
            if (snap?.hasMore !== true) return;
            if (snap.loadingOlder === true) { await delay(50); continue; }
            await session.loadOlder();
          }
        };
        run().catch(() => {});
        return () => { cancelled = true; };
      }, [sessionId, session]);

      // 测量 rail 位置 + 滚动追踪当前
      useEffect(() => {
        let last = null;
        const measure = () => {
          const el = document.querySelector("[data-conversation-scroll]");
          const next = el === null
            ? { left: Math.max(16, window.innerWidth - 26), top: 64, height: Math.min(480, Math.max(160, window.innerHeight * 0.62)) }
            : (() => {
                const r = el.getBoundingClientRect();
                return { left: Math.max(8, Math.min(r.right + 10, window.innerWidth - 26)), top: r.top + 44, height: Math.max(120, r.height - 88) };
              })();
          const same = last !== null && last.left === next.left && last.top === next.top && last.height === next.height;
          if (!same) { last = next; setRailRect(next); }
        };
        const updateActive = () => {
          const sp = document.querySelector("[data-conversation-scroll]");
          if (!sp || messages.length === 0) return;
          const rect = sp.getBoundingClientRect();
          if (rect.height === 0) return;
          const line = rect.top + rect.height * 0.4;
          let best = -1, bestDist = Infinity;
          for (let i = 0; i < messages.length; i++) {
            const el = findAnchor(messages[i].key);
            if (!el) continue;
            const r = el.getBoundingClientRect();
            const dist = Math.abs(r.top + r.height / 2 - line);
            if (dist < bestDist) { bestDist = dist; best = i; }
          }
          setActiveIndex(best);
        };
        measure();
        updateActive();
        window.addEventListener("resize", measure);
        const sp = document.querySelector("[data-conversation-scroll]");
        let ro = null;
        if (typeof ResizeObserver !== "undefined" && sp !== null) { ro = new ResizeObserver(measure); ro.observe(sp); }
        let scrollTimer = null;
        const onScroll = () => {
          if (scrollTimer !== null) return;
          scrollTimer = setTimeout(() => { scrollTimer = null; updateActive(); }, 60);
        };
        if (sp !== null) sp.addEventListener("scroll", onScroll, { passive: true });
        const timer = setInterval(() => { measure(); updateActive(); }, 2000);
        return () => {
          window.removeEventListener("resize", measure);
          if (scrollTimer !== null) clearTimeout(scrollTimer);
          if (sp !== null) sp.removeEventListener("scroll", onScroll);
          clearInterval(timer);
          if (ro !== null) ro.disconnect();
        };
      }, [sessionId, messages.length]);

      if (!sessionId || messages.length < 2 || railRect === null) return null;

      const { bar, gap } = layoutBars(messages.length, railRect.height);
      const moveFocus = (e, i) => {
        let next = i;
        if (e.key === "ArrowDown") next = Math.min(messages.length - 1, i + 1);
        else if (e.key === "ArrowUp") next = Math.max(0, i - 1);
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = messages.length - 1;
        else return;
        e.preventDefault();
        const bars = e.currentTarget.parentElement?.querySelectorAll("button.dqa-bar");
        bars?.[next]?.focus();
      };

      return createPortal(jsx("div", { className: "dqa-rail", style: { left: railRect.left, top: railRect.top, height: railRect.height }, role: "navigation", "aria-label": "消息导航", children:
        messages.map((m, i) => jsx("button", {
          key: m.seq,
          type: "button",
          className: "dqa-bar" + (activeIndex === i ? " active" : ""),
          style: { height: bar, marginBottom: i < messages.length - 1 ? gap : 0 },
          tabIndex: i === (activeIndex >= 0 ? activeIndex : 0) ? 0 : -1,
          title: m.text ? m.text.slice(0, 200) : "（无文本内容）",
          "aria-label": "用户: " + (m.text.slice(0, 60) || "（无文本内容）"),
          "aria-current": activeIndex === i ? "location" : undefined,
          onMouseEnter: () => setHover({ message: m, index: i + 1 }),
          onMouseLeave: () => setHover(null),
          onFocus: () => setHover({ message: m, index: i + 1 }),
          onBlur: () => setHover(null),
          onKeyDown: (e) => moveFocus(e, i),
          onClick: () => jumpToMessage(sessions, sessionId, m.key).catch(() => {})
        }))
      }), document.body);
    }

    // ── apply ──────────────────────────────────────────────────────────
    const inject = ["slots", "sessions"];

    function apply(ctx) {
      if (typeof document === "undefined") return;
      if (!document.querySelector('style[data-plugin-css="dsh-qa-anchors/base.css"]')) {
        const tag = document.createElement("style");
        tag.dataset.plugin = "dsh-qa-anchors";
        tag.dataset.pluginCss = "dsh-qa-anchors/base.css";
        tag.textContent = CSS;
        document.head.appendChild(tag);
      }
      ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
        name: "conversation.input.dock", id: "qa-anchors", order: 40,
        inject: () => ({ sessions: ctx.sessions })
      }, MessageRail));
    }

    return { apply, inject };
  }
});
