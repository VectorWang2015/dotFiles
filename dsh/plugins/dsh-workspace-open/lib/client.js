window.__ModuleLoader__.load({
  id: "dsh-workspace-open",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");

    function OpenWorkspaceFolderButton(props) {
      const { useSessions, useSession, sessionId, workspaces } = props;
      const [openError, setOpenError] = react.useState(null);
      const sessions = typeof useSessions === "function" ? useSessions((s) => s) : undefined;
      const currentSession = typeof useSession === "function" ? useSession((s) => s) : undefined;
      const currentId = sessionId ?? (currentSession != null ? currentSession.sessionId : undefined);
      const row = (currentId != null && sessions != null && sessions.byId != null) ? sessions.byId[currentId] : undefined;
      const cwd = row != null ? row.cwd : undefined;
      if (cwd == null || cwd === "") return null;
      return react.createElement("button", {
        type: "button",
        title: cwd,
        "aria-label": "打开工作区文件夹",
        onClick: (e) => {
          e.stopPropagation();
          setOpenError(null);
          if (workspaces == null || typeof workspaces.openPath !== "function") {
            setOpenError("openPath 不可用");
            return;
          }
          Promise.resolve(workspaces.openPath(cwd)).catch((err) => setOpenError(err != null && err.message != null ? String(err.message) : String(err)));
        },
        style: {
          cursor: "pointer", background: "transparent", border: "none",
          color: "var(--dsw-alias-label-secondary)", fontSize: "13px", lineHeight: "20px",
          padding: "0 4px", borderRadius: "6px"
        },
        onMouseEnter: (e) => { e.currentTarget.style.background = "var(--dsw-alias-interactive-bg-hover)"; },
        onMouseLeave: (e) => { e.currentTarget.style.background = "transparent"; }
      }, openError != null ? ("打开失败: " + openError) : "📂 打开工作区");
    }

    function apply(ctx) {
      const workspaces = ctx.get("workspaces");
      ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
        name: "conversation.session.header.actions",
        id: "open-workspace-folder",
        order: 30,
        label: () => "打开工作区文件夹"
      }, (props) => react.createElement(OpenWorkspaceFolderButton, {
        useSessions: props.useSessions,
        useSession: props.useSession,
        sessionId: props.sessionId,
        workspaces: workspaces
      })));
    }

    const name = "dsh-workspace-open";
    const inject = ["slots"];
    exports.apply = apply;
    exports.inject = inject;
    exports.name = name;
    return module.exports;
  }
});
