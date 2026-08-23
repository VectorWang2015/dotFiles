window.__ModuleLoader__.load({
  id: "dsh-session-hard-delete",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");

    function HardDeleteButton(props) {
      const { useSession, sessionId } = props;
      const [busy, setBusy] = react.useState(false);
      const [error, setError] = react.useState(null);
      const currentSession = typeof useSession === "function" ? useSession((s) => s) : undefined;
      const id = sessionId ?? (currentSession != null ? currentSession.sessionId : undefined);
      if (id == null || id === "") return null;
      return react.createElement("button", {
        type: "button",
        title: "永久删除当前会话（不可恢复）",
        "aria-label": "完全删除会话",
        disabled: busy,
        onClick: (e) => {
          e.stopPropagation();
          if (busy) return;
          if (!window.confirm("确定要完全删除当前会话吗？会话记录将被永久删除，无法恢复。")) return;
          setBusy(true);
          setError(null);
          fetch("/api/session/hard-delete", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sessionId: id }),
          })
            .then((res) => res.json().catch(() => ({})).then((body) => ({ ok: res.ok === true && body.ok === true, error: body.error })))
            .then((result) => {
              if (result.ok) {
                window.location.reload();
              } else {
                setBusy(false);
                setError(result.error != null && result.error !== "" ? result.error : "删除失败");
              }
            })
            .catch((err) => {
              setBusy(false);
              setError(err != null && err.message != null ? String(err.message) : String(err));
            });
        },
        style: {
          cursor: "pointer", background: "transparent", border: "none",
          color: "var(--dsw-alias-label-secondary)", fontSize: "13px", lineHeight: "20px",
          padding: "0 4px", borderRadius: "6px", opacity: busy ? 0.6 : 1
        },
        onMouseEnter: (e) => { e.currentTarget.style.background = "var(--dsw-alias-interactive-bg-hover)"; },
        onMouseLeave: (e) => { e.currentTarget.style.background = "transparent"; }
      }, busy ? "删除中…" : (error != null ? ("删除失败: " + error) : "🗑 完全删除"));
    }

    function apply(ctx) {
      ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
        name: "conversation.session.header.actions",
        id: "hard-delete-session",
        order: 40,
        label: () => "完全删除会话"
      }, (props) => react.createElement(HardDeleteButton, {
        useSession: props.useSession,
        sessionId: props.sessionId
      })));
    }

    const name = "dsh-session-hard-delete";
    const inject = ["slots"];
    exports.apply = apply;
    exports.inject = inject;
    exports.name = name;
    return module.exports;
  }
});
