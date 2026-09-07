window.__ModuleLoader__.load({
  id: "dsh-workspace-open",
  factory: (require) => {
    const React = require("react");

    function OpenWorkspaceFolderButton({ useSessions, sessionId, openPath }) {
      const cwd = useSessions((state) => state.byId[sessionId]?.cwd);
      const [openError, setOpenError] = React.useState(null);
      const [pending, setPending] = React.useState(false);
      const inFlight = React.useRef(false);
      if (typeof cwd !== "string" || cwd === "") return null;

      return React.createElement("button", {
        type: "button",
        title: cwd,
        "aria-label": "打开工作区文件夹",
        disabled: pending,
        onClick: async (event) => {
          event.stopPropagation();
          if (inFlight.current) return;
          inFlight.current = true;
          setPending(true);
          setOpenError(null);
          try {
            await openPath(cwd);
          } catch (error) {
            setOpenError(error instanceof Error ? error.message : String(error));
          } finally {
            inFlight.current = false;
            setPending(false);
          }
        },
        style: {
          cursor: pending ? "wait" : "pointer",
          background: "transparent",
          border: "none",
          color: "var(--dsw-alias-label-secondary)",
          fontSize: "13px",
          lineHeight: "20px",
          padding: "0 4px",
          borderRadius: "6px",
        },
        onMouseEnter: (event) => {
          event.currentTarget.style.background = "var(--dsw-alias-interactive-bg-hover)";
        },
        onMouseLeave: (event) => {
          event.currentTarget.style.background = "transparent";
        },
      }, pending ? "打开中…" : openError ? `打开失败: ${openError}` : "📂 打开工作区");
    }

    function apply(ctx) {
      const openPath = async (path) => {
        // Native folder actions must not be redirected by preview plugins that
        // shadow remote.session.openWorkspacePath. Connection keeps authentication
        // and request correlation while calling the same public Host endpoint.
        const result = await ctx.connection.rpc.call("/api", "session/openWorkspacePath", {
          args: { request: { path } },
        });
        if (!result.ok) throw new Error(result.error.message);
      };
      ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
        name: "conversation.session.header.actions",
        id: "open-workspace-folder",
        order: 30,
        label: () => "打开工作区文件夹",
      }, (props) => React.createElement(OpenWorkspaceFolderButton, {
        useSessions: props.useSessions,
        sessionId: props.sessionId,
        openPath,
      })));
    }

    return {
      name: "dsh-workspace-open",
      inject: ["slots", "connection"],
      apply,
    };
  },
});
