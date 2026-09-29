"""MCP server exposing Prelude to voice-agent stacks — F19.

Run with a gateway up (`make up`):

    PRELUDE_GATEWAY_URL=http://localhost/api python server.py

Tools map one-to-one onto gateway routes; the session token is returned by
`prelude_start_session` and passed back explicitly, so the adapter holds
no state of its own and one MCP server can serve many sessions.
"""
from __future__ import annotations

import os

from mcp.server.fastmcp import FastMCP

from adapter import PreludeClient, render_answer

mcp = FastMCP("prelude")
_client = PreludeClient(os.environ.get("PRELUDE_GATEWAY_URL", "http://localhost/api"))


@mcp.tool()
def prelude_start_session() -> dict:
    """Start a Prelude session. Returns {session_id, token}; pass `token` to the other tools."""
    return _client.start_session()


@mcp.tool()
def prelude_turn(token: str, chunk_index: int, text: str) -> dict:
    """Feed one transcript chunk. Returns the controller decision, the current
    claim list with citations, the diff from the previous version, and this
    turn's retrieval evidence."""
    return _client.turn(token, chunk_index, text)


@mcp.tool()
def prelude_answer(token: str, chunk_index: int, text: str) -> str:
    """Feed one chunk and get the answer rendered as plain text with
    [Doc_ID §Section] citations — for stacks that speak the result aloud."""
    return render_answer(_client.turn(token, chunk_index, text))


@mcp.tool()
def prelude_claims(token: str) -> list[dict]:
    """The session's current claim graph (verified + uncertainty claims)."""
    return _client.claims(token)


@mcp.tool()
def prelude_verify_telemetry() -> dict:
    """Check the gateway's hash-chained telemetry log is intact."""
    return _client.verify_telemetry()


if __name__ == "__main__":
    mcp.run()
