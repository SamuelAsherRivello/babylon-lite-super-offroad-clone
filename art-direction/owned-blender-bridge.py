"""Bounded official addon bridge, launched only with .NET CreateNoWindow.

The reviewed skill runner applies CREATE_NO_WINDOW at worker and Blender
boundaries and owns all descendants with a kill-on-close Windows Job.
This is the existing official addon on the configured endpoint, not a new MCP
implementation. It runs in a private factory scene and changes no preferences.
"""
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, r'D:/Documents/Projects/VC/AI/ai-skills-blender-codex/skills/blender-setup/scripts')
from windowless import run

code = (
    "import sys; "
    "sys.path.insert(0, r'C:/Users/srive/.codex/tools/blender-mcp-official/addon'); "
    "from blender_mcp_addon.cli import cli_execute; "
    "cli_execute(['--host','127.0.0.1','--port','9876'])"
)
try:
    response = run(
        [r'D:/SteamLibrary/steamapps/common/Blender/blender.exe',
         '--background', '--factory-startup', '--python-expr', code],
        timeout=2700, cwd=root,
    )
    result = {'returncode': response.returncode,
              'stdout': response.stdout[-6000:], 'stderr': response.stderr[-6000:]}
except Exception as error:
    result = {'error': type(error).__name__, 'message': str(error)[:1000]}
(root / 'art-direction/bridge-session-result.json').write_text(json.dumps(result, indent=2))
