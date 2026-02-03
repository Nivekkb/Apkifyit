"""
DayZero Builder (v2) - Multi-Agent Web App Generator
- Deterministic stage orchestration (no generator misuse)
- Strict JSON file bundle output (robust parsing)
- Safe file writes (path traversal protection + limits)
"""

from __future__ import annotations
from .prompts_v2 import PROMPTS

builder = DayZeroBuilderV2(
    agent_instance=agent,
    prompts=PROMPTS,
    streaming_callback=print,
    governance_level="strict"
)

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple
from datetime import datetime
import json
import os
import re
import time
import tempfile


class AgentType(Enum):
    PLANNING = "planning"
    UIUX = "uiux"
    FRONTEND = "frontend"
    BACKEND = "backend"
    PWA = "pwa"
    QA = "qa"
    GOVERNANCE = "governance"
    DEPLOYMENT = "deployment"


class BuildStage(Enum):
    PLANNING = "planning"
    DESIGN = "design"
    FRONTEND = "frontend"
    BACKEND = "backend"
    PWA = "pwa"
    QA = "qa"
    GOVERNANCE = "governance"
    COMPLETE = "complete"
    FAILED = "failed"


@dataclass
class AgentResponse:
    agent_type: AgentType
    stage: BuildStage
    content: str
    files: Dict[str, str] = field(default_factory=dict)        # path -> content
    suggestions: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)
    governance_compliant: bool = True
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "agent_type": self.agent_type.value,
            "stage": self.stage.value,
            "content": self.content,
            "files": self.files,
            "suggestions": self.suggestions,
            "errors": self.errors,
            "warnings": self.warnings,
            "dependencies": self.dependencies,
            "governance_compliant": self.governance_compliant,
            "timestamp": self.timestamp,
        }


@dataclass
class BuildContext:
    project_name: str
    description: str
    tech_stack: Dict[str, str] = field(default_factory=lambda: {
        "frontend": "React + Vite + Tailwind",
        "backend": "Node.js + Express + Drizzle",
        "database": "PostgreSQL",
        "pwa": "Workbox",
    })
    output_dir: Path = field(default_factory=lambda: Path("./output"))
    responses: List[AgentResponse] = field(default_factory=list)
    current_stage: BuildStage = BuildStage.PLANNING
    errors_encountered: List[str] = field(default_factory=list)

    def add_response(self, r: AgentResponse) -> None:
        self.responses.append(r)
        self.current_stage = r.stage
        if r.errors:
            self.errors_encountered.extend(r.errors)

    def last_content(self, stage: BuildStage) -> str:
        for r in reversed(self.responses):
            if r.stage == stage:
                return r.content
        return ""

    def merged_files(self) -> Dict[str, str]:
        out: Dict[str, str] = {}
        for r in self.responses:
            for p, c in (r.files or {}).items():
                out[p] = c
        return out


class DayZeroBuilderV2:
    def __init__(
        self,
        agent_instance: Any,
        prompts: Dict[str, str],
        streaming_callback: Optional[Callable[[str], None]] = None,
        governance_level: str = "standard",
        # safety limits
        max_files: int = 300,
        max_total_bytes: int = 8_000_000,   # ~8MB
        max_file_bytes: int = 1_000_000,    # ~1MB per file
    ):
        self.agent = agent_instance
        self.prompts = prompts
        self.cb = streaming_callback or (lambda s: None)
        self.governance_level = governance_level

        self.max_files = max_files
        self.max_total_bytes = max_total_bytes
        self.max_file_bytes = max_file_bytes

    # -----------------------------
    # Public API
    # -----------------------------
    def run(
        self,
        project_name: str,
        project_description: str,
        include_backend: bool = True,
        output_dir: Optional[Path] = None,
    ) -> BuildContext:
        ctx = BuildContext(
            project_name=project_name,
            description=project_description,
            output_dir=output_dir or Path(f"./{project_name}"),
        )

        self._thought("Starting orchestration")
        self._thought(f"Project: {project_name}")

        try:
            plan = self._run_planning(ctx)
            ctx.add_response(plan)

            uiux = self._run_uiux(ctx)
            ctx.add_response(uiux)

            fe = self._run_frontend(ctx)
            ctx.add_response(fe)

            if include_backend:
                be = self._run_backend(ctx)
                ctx.add_response(be)

            pwa = self._run_pwa(ctx)
            ctx.add_response(pwa)

            qa = self._run_qa(ctx)
            ctx.add_response(qa)

            if self.governance_level in ("strict", "audit"):
                gov = self._run_governance(ctx)
                ctx.add_response(gov)
                # hard gate if you want strict enforcement:
                if not gov.governance_compliant:
                    raise RuntimeError("Governance non-compliant: blocking file generation")

            self._write_all_files(ctx)

            ctx.current_stage = BuildStage.COMPLETE
            self._thought(f"Build complete → {ctx.output_dir}")
            return ctx

        except Exception as e:
            ctx.current_stage = BuildStage.FAILED
            ctx.errors_encountered.append(str(e))
            self._thought(f"Build failed: {e}")
            return ctx

    # -----------------------------
    # Stage runners
    # -----------------------------
    def _run_planning(self, ctx: BuildContext) -> AgentResponse:
        system = self.prompts["planning"]
        user = f"""Project: {ctx.project_name}
Description: {ctx.description}

Return a concise technical plan (no code). Include:
- routes/screens
- entities/data model
- API endpoints
- auth approach
- risks / open questions
"""
        text = self._invoke_text(system, user, stream=True)
        deps = self._extract_deps_from_text(text)
        return AgentResponse(
            agent_type=AgentType.PLANNING,
            stage=BuildStage.PLANNING,
            content=text,
            dependencies=deps,
        )

    def _run_uiux(self, ctx: BuildContext) -> AgentResponse:
        plan = ctx.last_content(BuildStage.PLANNING)
        system = self.prompts["uiux"]
        user = f"""Project: {ctx.project_name}
Description: {ctx.description}

Plan:
{plan}

Return a design spec (no code). Include:
- layout + navigation
- component inventory
- Tailwind tokens (colors/typography/spacing)
- accessibility notes
- offline states + install UX
"""
        text = self._invoke_text(system, user, stream=True)
        return AgentResponse(
            agent_type=AgentType.UIUX,
            stage=BuildStage.DESIGN,
            content=text,
            suggestions=["Mobile-first", "A11y-first", "Offline UX"],
        )

    def _run_frontend(self, ctx: BuildContext) -> AgentResponse:
        design = ctx.last_content(BuildStage.DESIGN)
        system = self.prompts["frontend"]
        user = f"""Project: {ctx.project_name}

Design spec:
{design}

You MUST output a single JSON object, and nothing else, with this schema:

{{
  "files": [{{"path": "frontend/...", "content": "..." }}],
  "package_json": {{ ... }}  // valid package.json object
}}

Rules:
- Use React + Vite + Tailwind + React Router
- All paths must be under "frontend/"
- Include: vite config, tailwind config, src/main.tsx, src/App.tsx, router, components, pages
- Content strings must be valid text, no base64.
"""
        raw = self._invoke_text(system, user, stream=False)
        files, deps, errors = self._parse_file_bundle(raw, prefer_package_json=True)

        return AgentResponse(
            agent_type=AgentType.FRONTEND,
            stage=BuildStage.FRONTEND,
            content=raw,
            files=files,
            dependencies=deps,
            errors=errors,
        )

    def _run_backend(self, ctx: BuildContext) -> AgentResponse:
        plan = ctx.last_content(BuildStage.PLANNING)
        system = self.prompts["backend"]
        user = f"""Project: {ctx.project_name}

Plan:
{plan}

You MUST output a single JSON object, and nothing else, with this schema:

{{
  "files": [{{"path": "backend/...", "content": "..." }}],
  "package_json": {{ ... }}  // valid package.json object
}}

Rules:
- Node.js + Express
- Drizzle ORM (schema + migration approach)
- JWT auth, Zod validation, rate limiting, CORS, error middleware
- All paths must be under "backend/"
"""
        raw = self._invoke_text(system, user, stream=False)
        files, deps, errors = self._parse_file_bundle(raw, prefer_package_json=True)

        return AgentResponse(
            agent_type=AgentType.BACKEND,
            stage=BuildStage.BACKEND,
            content=raw,
            files=files,
            dependencies=deps,
            errors=errors,
        )

    def _run_pwa(self, ctx: BuildContext) -> AgentResponse:
        system = self.prompts["pwa"]
        user = f"""Project: {ctx.project_name}

You MUST output a single JSON object, and nothing else, with this schema:

{{
  "files": [{{"path": "frontend/...", "content": "..." }}]
}}

Rules:
- Add manifest, service worker/workbox or Vite PWA plugin
- Offline fallback route/page
- Install prompt component
- Update available notification
- Paths must be under "frontend/"
"""
        raw = self._invoke_text(system, user, stream=False)
        files, deps, errors = self._parse_file_bundle(raw, prefer_package_json=False)
        return AgentResponse(
            agent_type=AgentType.PWA,
            stage=BuildStage.PWA,
            content=raw,
            files=files,
            dependencies=deps,
            errors=errors,
        )

    def _run_qa(self, ctx: BuildContext) -> AgentResponse:
        all_files = ctx.merged_files()
        system = self.prompts["qa"]
        user = f"""Project: {ctx.project_name}

You are reviewing generated code.

Return JSON only:
{{
  "critical": ["..."],
  "warnings": ["..."],
  "suggestions": ["..."]
}}

Consider: XSS/CSRF, auth, validation, error handling, PWA, a11y, perf.
Here is file list (no contents):
{json.dumps(sorted(list(all_files.keys())), indent=2)}
"""
        raw = self._invoke_text(system, user, stream=True)
        critical, warnings, suggestions = self._parse_qa_json(raw)
        return AgentResponse(
            agent_type=AgentType.QA,
            stage=BuildStage.QA,
            content=raw,
            errors=critical,
            warnings=warnings,
            suggestions=suggestions,
        )

    def _run_governance(self, ctx: BuildContext) -> AgentResponse:
        system = self.prompts.get("governance", "You are a governance auditor.")
        user = f"""Project: {ctx.project_name}

Return JSON only:
{{
  "compliant": true/false,
  "critical": ["..."],
  "warnings": ["..."],
  "suggestions": ["..."]
}}

Evaluate: validation, auth, logging, rate limiting, safe defaults, reversibility.
"""
        raw = self._invoke_text(system, user, stream=True)
        compliant, critical, warnings, suggestions = self._parse_governance_json(raw)

        return AgentResponse(
            agent_type=AgentType.GOVERNANCE,
            stage=BuildStage.GOVERNANCE,
            content=raw,
            governance_compliant=compliant,
            errors=critical,
            warnings=warnings,
            suggestions=suggestions,
        )

    # -----------------------------
    # LLM invocation
    # -----------------------------
    def _invoke_text(self, system_prompt: str, user_prompt: str, stream: bool) -> str:
        if stream and hasattr(self.agent, "chat_stream"):
            chunks: List[str] = []
            for chunk in self.agent.chat_stream(user_prompt, system=system_prompt):
                chunks.append(chunk)
                # stream only small chunks; caller chooses whether to show raw output
                self.cb(chunk)
            return "".join(chunks)

        # fallback
        if hasattr(self.agent, "provider") and hasattr(self.agent.provider, "chat"):
            resp = self.agent.provider.chat([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ])
            return resp if isinstance(resp, str) else str(resp)

        # generic fallback if agent has chat()
        if hasattr(self.agent, "chat"):
            return self.agent.chat(user_prompt, system=system_prompt)

        raise RuntimeError("Agent instance does not support chat or provider.chat")

    # -----------------------------
    # Parsing helpers (strict JSON)
    # -----------------------------
    def _parse_file_bundle(
        self,
        raw: str,
        prefer_package_json: bool,
    ) -> Tuple[Dict[str, str], List[str], List[str]]:
        """
        Returns: (files, dependencies, errors)
        Expects raw to be a JSON object with "files": [{"path","content"}]
        Optionally "package_json": {..}
        """
        errors: List[str] = []
        obj = self._safe_json_load(raw)
        if obj is None or not isinstance(obj, dict):
            return {}, [], ["Invalid JSON output for file bundle"]

        files_list = obj.get("files", [])
        if not isinstance(files_list, list):
            return {}, [], ["'files' must be a list"]

        files: Dict[str, str] = {}
        total_bytes = 0

        for i, item in enumerate(files_list):
            if not isinstance(item, dict):
                errors.append(f"files[{i}] is not an object")
                continue
            path = str(item.get("path", "")).strip()
            content = item.get("content", "")
            if not isinstance(content, str):
                errors.append(f"{path or f'files[{i}]'} content is not a string")
                continue

            path_err = self._validate_relpath(path)
            if path_err:
                errors.append(f"Invalid path '{path}': {path_err}")
                continue

            b = len(content.encode("utf-8", errors="ignore"))
            if b > self.max_file_bytes:
                errors.append(f"File too large: {path} ({b} bytes)")
                continue

            total_bytes += b
            if total_bytes > self.max_total_bytes:
                errors.append("Total output too large; exceeded max_total_bytes")
                break

            files[path] = content

            if len(files) > self.max_files:
                errors.append("Too many files; exceeded max_files")
                break

        deps: List[str] = []
        if prefer_package_json and isinstance(obj.get("package_json"), dict):
            deps = self._deps_from_package_json_obj(obj["package_json"])
            # also write package.json if not present in files
            # choose location based on file paths already present
            pkg_path = self._infer_package_json_path(files)
            if pkg_path and pkg_path not in files:
                files[pkg_path] = json.dumps(obj["package_json"], indent=2)

        return files, deps, errors

    def _safe_json_load(self, raw: str) -> Optional[Any]:
        raw = raw.strip()
        # If model wraps in ```json ... ```, unwrap
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-zA-Z]*\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
            raw = raw.strip()
        try:
            return json.loads(raw)
        except Exception:
            return None

    def _deps_from_package_json_obj(self, pkg: Dict[str, Any]) -> List[str]:
        deps = []
        for key in ("dependencies", "devDependencies"):
            block = pkg.get(key, {})
            if isinstance(block, dict):
                deps.extend(list(block.keys()))
        return sorted(set(deps))

    def _infer_package_json_path(self, files: Dict[str, str]) -> Optional[str]:
        # if any file starts with frontend/ -> frontend/package.json
        if any(p.startswith("frontend/") for p in files.keys()):
            return "frontend/package.json"
        if any(p.startswith("backend/") for p in files.keys()):
            return "backend/package.json"
        return None

    def _parse_qa_json(self, raw: str) -> Tuple[List[str], List[str], List[str]]:
        obj = self._safe_json_load(raw)
        if not isinstance(obj, dict):
            return (["QA output invalid JSON"], [], [])
        critical = obj.get("critical", [])
        warnings = obj.get("warnings", [])
        suggestions = obj.get("suggestions", [])
        return (
            critical if isinstance(critical, list) else ["QA critical not a list"],
            warnings if isinstance(warnings, list) else [],
            suggestions if isinstance(suggestions, list) else [],
        )

    def _parse_governance_json(self, raw: str) -> Tuple[bool, List[str], List[str], List[str]]:
        obj = self._safe_json_load(raw)
        if not isinstance(obj, dict):
            return (False, ["Governance output invalid JSON"], [], [])
        compliant = bool(obj.get("compliant", False))
        critical = obj.get("critical", [])
        warnings = obj.get("warnings", [])
        suggestions = obj.get("suggestions", [])
        return (
            compliant,
            critical if isinstance(critical, list) else ["Governance critical not a list"],
            warnings if isinstance(warnings, list) else [],
            suggestions if isinstance(suggestions, list) else [],
        )

    # -----------------------------
    # Dependency fallback extraction (planning text)
    # -----------------------------
    def _extract_deps_from_text(self, text: str) -> List[str]:
        # Lightweight fallback only; real deps should come from package.json
        candidates = re.findall(r"\b(react|vite|tailwind|express|drizzle|zod|postgresql|workbox)\b", text, re.I)
        return sorted(set([c.lower() for c in candidates]))

    # -----------------------------
    # Safe file writing
    # -----------------------------
    def _validate_relpath(self, p: str) -> Optional[str]:
        if not p:
            return "empty path"
        if "\x00" in p:
            return "null byte"
        # absolute paths
        if p.startswith("/") or re.match(r"^[A-Za-z]:[\\/]", p):
            return "absolute path not allowed"
        # normalize separators
        p2 = p.replace("\\", "/")
        # reject traversal
        parts = [x for x in p2.split("/") if x not in ("", ".")]
        if any(x == ".." for x in parts):
            return "path traversal '..' not allowed"
        return None

    def _safe_join(self, root: Path, rel: str) -> Path:
        rel = rel.replace("\\", "/")
        out = (root / rel).resolve()
        root_res = root.resolve()
        # ensure under root
        if not str(out).startswith(str(root_res) + os.sep) and out != root_res:
            raise ValueError(f"Refusing to write outside output_dir: {rel}")
        return out

    def _write_all_files(self, ctx: BuildContext) -> None:
        outdir = ctx.output_dir
        outdir.mkdir(parents=True, exist_ok=True)

        all_files = ctx.merged_files()
        if not all_files:
            raise RuntimeError("No files generated")

        # limits
        if len(all_files) > self.max_files:
            raise RuntimeError(f"Too many files: {len(all_files)} > {self.max_files}")

        total = sum(len(c.encode("utf-8", errors="ignore")) for c in all_files.values())
        if total > self.max_total_bytes:
            raise RuntimeError(f"Total output too large: {total} > {self.max_total_bytes}")

        self._thought(f"Writing {len(all_files)} files")

        for rel_path, content in all_files.items():
            err = self._validate_relpath(rel_path)
            if err:
                raise RuntimeError(f"Invalid output path '{rel_path}': {err}")

            target = self._safe_join(outdir, rel_path)
            target.parent.mkdir(parents=True, exist_ok=True)

            data = content.encode("utf-8", errors="ignore")
            if len(data) > self.max_file_bytes:
                raise RuntimeError(f"File too large: {rel_path}")

            # atomic write
            with tempfile.NamedTemporaryFile("wb", delete=False, dir=str(target.parent)) as tmp:
                tmp.write(data)
                tmp_path = Path(tmp.name)

            tmp_path.replace(target)

    # -----------------------------
    # Thought streaming
    # -----------------------------
    def _thought(self, msg: str) -> None:
        self.cb(f"{msg}\n")
        time.sleep(0.05)
