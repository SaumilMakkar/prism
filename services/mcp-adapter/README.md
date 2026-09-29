# mcp-adapter — Prelude as an MCP tool (F19)

An adapter over the gateway's HTTP API, exposed as MCP tools over stdio so a
voice-agent stack (or Claude Desktop / Claude Code) can drive Prelude
without knowing its routes. It is deliberately not a core component: it
holds no state and touches nothing inside the engine.

```
make up
cd services/mcp-adapter
pip install -r requirements.txt
PRELUDE_GATEWAY_URL=http://localhost/api python server.py
```

Tools: `prelude_start_session`, `prelude_turn`, `prelude_answer` (plain text
with `[Doc_ID §Section]` citations), `prelude_claims`, `prelude_verify_telemetry`.

Claude Code registration, for example:

```
claude mcp add prelude -e PRELUDE_GATEWAY_URL=http://localhost/api -- python services/mcp-adapter/server.py
```

Tests (`pytest`) use an httpx mock transport; no gateway or MCP runtime needed.
