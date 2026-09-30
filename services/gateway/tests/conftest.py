"""Session-wide test environment. Loaded before any test module, so the
module-level constants in app.telemetry / app.main see these values.

TELEMETRY_DIR defaults to /telemetry, which CI runners cannot create.
"""
import os
import tempfile

os.environ.setdefault("TELEMETRY_DIR", tempfile.mkdtemp(prefix="prelude-telemetry-"))
