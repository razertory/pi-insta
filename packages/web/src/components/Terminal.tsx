import React, { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

interface TerminalProps {
  sessionId: string;
  onExit?: (exitCode: number) => void;
}

const encoder = new TextEncoder();

export const Terminal: React.FC<TerminalProps> = ({ sessionId, onExit }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected" | "exited">(
    "connecting"
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      theme: {
        background: "#090d16",
        foreground: "#e0e6ed",
        cursor: "#38bdf8",
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    let ws: WebSocket | null = null;
    let disposed = false;
    let exited = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const sendResize = () => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    };

    const connect = () => {
      if (disposed || exited) return;
      setStatus("connecting");

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${protocol}//${window.location.host}/ws?session=${sessionId}`);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        setStatus("connected");
        sendResize();
      };

      ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          // Control frame
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "exit") {
              exited = true;
              setStatus("exited");
              term.write(`\r\n\x1b[90m[Process exited with code ${msg.exitCode}]\x1b[0m\r\n`);
              onExit?.(msg.exitCode);
            }
          } catch {
            // Ignore
          }
          return;
        }
        // Binary frame: terminal output
        term.write(new Uint8Array(event.data as ArrayBuffer));
      };

      ws.onclose = () => {
        if (disposed || exited) return;
        setStatus("disconnected");
        // Auto-reconnect: the session lives on the server, reattach replays the buffer
        reconnectTimer = setTimeout(() => {
          term.reset();
          connect();
        }, 1500);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    const dataDisposable = term.onData((data) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(encoder.encode(data));
      }
    });

    const handleResize = () => {
      fitAddon.fit();
      sendResize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      dataDisposable.dispose();
      window.removeEventListener("resize", handleResize);
      ws?.close();
      term.dispose();
    };
  }, [sessionId]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {status !== "connected" && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 20,
            zIndex: 10,
            padding: "4px 10px",
            borderRadius: "4px",
            fontSize: "12px",
            backgroundColor:
              status === "connecting" ? "#eab308" : status === "exited" ? "#64748b" : "#ef4444",
            color: "#000",
            fontWeight: "bold",
          }}
        >
          {status === "connecting"
            ? "Connecting..."
            : status === "exited"
              ? "Exited"
              : "Disconnected — retrying"}
        </div>
      )}
      <div ref={containerRef} style={{ width: "100%", height: "100%", padding: "8px" }} />
    </div>
  );
};
