# pi-insta

Web-based Pi Agent terminal. Users interact with Pi's TUI directly in the browser.

## Architecture

```
Browser (xterm.js) ←— WebSocket —→ Hono (Node.js) ←— PTY (node-pty) —→ pi (interactive mode)
```

- **Frontend**: React + xterm.js. Renders Pi's TUI output as-is via ANSI sequences. No custom UI layer — the browser is just a terminal viewport.
- **Backend**: Hono + node-pty. Spawns `pi` as a PTY subprocess, bridges stdin/stdout over WebSocket. Serves the built frontend as static files.
- **Protocol**: Raw bytes over WebSocket. Keyboard input → PTY stdin, PTY stdout → terminal render. Resize events synced via a JSON control message.

## Tech Stack

- **Monorepo**: pnpm workspaces
- **Server** (`packages/server`): Hono, @hono/node-server, node-pty, ws
- **Web** (`packages/web`): React, xterm.js, xterm-addon-fit, Vite

## Project Structure

```
packages/
  server/
    src/
      index.ts        # Hono app: static files + WebSocket upgrade
      pty.ts           # PTY lifecycle: spawn pi, resize, cleanup
  web/
    src/
      main.tsx         # React entry
      App.tsx          # Layout shell
      components/
        Terminal.tsx    # xterm.js instance + WebSocket connection
      hooks/
        useWebSocket.ts  # WS connection management, reconnect logic
    index.html
    vite.config.ts
```

## Development

```bash
pnpm install
pnpm dev          # starts both Vite dev server and Hono backend
```

## Build & Production

```bash
pnpm build        # builds web into packages/web/dist, then compiles server
pnpm start        # runs Hono serving static files + WebSocket
```

## Conventions

- No Pi SDK dependency — we spawn `pi` CLI directly via PTY
- WebSocket carries raw terminal I/O; only resize uses a JSON control frame
- One PTY per WebSocket connection; dispose PTY on disconnect
- Frontend does no interpretation of Pi output — xterm.js handles all ANSI rendering
