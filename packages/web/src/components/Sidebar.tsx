import React, { useState } from "react";
import type { SessionInfo } from "../api";

interface SidebarProps {
  sessions: SessionInfo[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeId,
  onSelect,
  onCreate,
  onDelete,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <aside
      style={{
        width: "220px",
        minWidth: "220px",
        height: "100%",
        backgroundColor: "#0f172a",
        borderRight: "1px solid #1e293b",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "12px",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Sessions
        </span>
        <button
          onClick={onCreate}
          style={{
            background: "none",
            border: "1px solid #334155",
            borderRadius: "4px",
            color: "#cbd5e1",
            cursor: "pointer",
            padding: "2px 8px",
            fontSize: "12px",
          }}
        >
          + New
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {sessions.length === 0 && (
          <div style={{ padding: "16px 12px", fontSize: "12px", color: "#475569" }}>
            No sessions yet.
          </div>
        )}
        {sessions.map((s) => {
          const isActive = s.id === activeId;
          const isHovered = s.id === hoveredId;
          return (
            <div
              key={s.id}
              onClick={() => onSelect(s.id)}
              onMouseEnter={() => setHoveredId(s.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: isActive ? "#1e293b" : isHovered ? "#16203255" : "transparent",
                borderLeft: isActive ? "2px solid #38bdf8" : "2px solid transparent",
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  backgroundColor: s.status === "running" ? "#4ade80" : "#64748b",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: "13px",
                  color: s.status === "running" ? "#e2e8f0" : "#64748b",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.name}
              </span>
              {isHovered && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(s.id);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    fontSize: "14px",
                    padding: "0 2px",
                    lineHeight: 1,
                  }}
                  title="Delete session"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
