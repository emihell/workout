#!/usr/bin/env python3
"""req-271 — the DEC index: one generated line per decision, from the range files.

Layout (after `scripts/dec_split.py` has run once):

  handoff/log/DECISIONS.md           header + the topical digest + the generated index
  handoff/log/decisions/DEC-001-050.md, DEC-051-100.md, …   the entries, 50 per file

Each index line is `- DEC-NNN · date · title · status`, grouped under the range file that holds
the entry. status is `live`, `superseded by DEC-x`, `superseded in part by DEC-x` or
`amended by DEC-x §k`, read only from a marker at the entry's top (a blockquote line before the
body: `> **SUPERSEDED by DEC-x** …`, `> **SUPERSEDED in part** — … DEC-x …`, `> AMENDED by DEC-x §k`).
An amendment written only in prose leaves the entry `live`.

Everything from the `## Decision index` heading to the end of DECISIONS.md is this script's
output; everything above it is hand-written and kept byte for byte. Same input → same bytes.

Refuses (exit 2, the file:line named, nothing written) on a malformed `## DEC` heading, an
entry with no date, a duplicate id, an entry in the wrong range file, or text before a range
file's first entry. `./plan save` runs it whenever a range file changed.

  python3 scripts/dec_index.py [--root DIR] [--check]

--check writes nothing and exits 1 when the committed index differs from the output.
The parsing is shared: scripts/dec_split.py and scripts/check_handoff.py import it.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from dataclasses import dataclass, field

DECISIONS_PATH = "handoff/log/DECISIONS.md"
DECISIONS_DIR = "handoff/log/decisions"
RANGE_SIZE = 50
INDEX_HEADING = "## Decision index"
DIGEST_HEADING = "## Current rules digest"
REGEN_COMMAND = "python3 scripts/dec_index.py"

ENTRY_RE = re.compile(r"^## DEC-(\d{3}) — (\S.*)$")
# The one non-entry `## DEC` heading the log carries (DEC-035's addendum, DECISIONS.md:797 before
# the split): it belongs to the entry above it and moves with it.
ADDENDUM_RE = re.compile(r"^## DEC-(\d{3}) follow-up\b")
# Anything that looks like it wants to be a DEC heading — caught so a typo can't silently fold
# an entry into the one above it.
DECISH_RE = re.compile(r"^#{1,6}\s*DEC\b", re.I)
RANGE_FILE_RE = re.compile(r"^DEC-(\d{3})-(\d{3})\.md$")
ISO_DATE_RE = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")
# A parenthesised group carrying the date, e.g. `  (Emilio, 2026-09-10)` — dropped from the title.
DATE_PAREN_RE = re.compile(r"\s*\([^()]*\b\d{4}-\d{2}-\d{2}\b[^()]*\)")
DEC_ID_RE = re.compile(r"\bDEC-(\d{3,})\b")
MARKER_RE = re.compile(r"^>\s*\**\s*(SUPERSEDED|AMENDED)\b(\s+in\s+part)?", re.I)
AMEND_REF_RE = re.compile(r"\bDEC-(\d{3})((?:\**\s*§\s*[\d][\d.,–\- ]*)?)")


class DecError(Exception):
    """A refusal: the message names file:line."""


@dataclass
class Entry:
    num: int
    title: str
    date: str
    path: str            # the file it lives in (e.g. handoff/log/decisions/DEC-001-050.md)
    line: int            # 1-based heading line in that file
    kind: str = "live"   # live | superseded | partial | amended
    status: str = "live"
    refs: list[str] = field(default_factory=list)

    @property
    def id(self) -> str:
        return f"DEC-{self.num:03d}"


def range_name(num: int) -> str:
    lo = (num - 1) // RANGE_SIZE * RANGE_SIZE + 1
    return f"DEC-{lo:03d}-{lo + RANGE_SIZE - 1:03d}.md"


def _status(marker_lines: list[str]) -> tuple[str, str]:
    """(kind, status text) from the blockquote lines at an entry's top."""
    superseded: tuple[str, str] | None = None
    amended: list[str] = []
    # Group the blockquote into markers: a line matching MARKER_RE starts one, following `>`
    # lines continue it.
    groups: list[tuple[re.Match, str]] = []
    for ln in marker_lines:
        m = MARKER_RE.match(ln)
        if m:
            groups.append((m, ln))
        elif groups:
            groups[-1] = (groups[-1][0], groups[-1][1] + " " + ln)
    for m, text in groups:
        rest = text[m.end():]
        word, part = m.group(1).upper(), bool(m.group(2))
        if word == "SUPERSEDED":
            ref = DEC_ID_RE.search(rest)
            target = f" by DEC-{ref.group(1)}" if ref else ""
            if part:
                superseded = superseded or ("partial", f"superseded in part{target}")
            else:
                superseded = ("superseded", f"superseded{target}")
        else:
            ref = AMEND_REF_RE.search(rest)
            if ref:
                sec = re.sub(r"[*\s]+", " ", ref.group(2)).strip().rstrip(".,– -")
                amended.append(f"DEC-{ref.group(1)}" + (f" {sec}" if sec else ""))
            else:
                amended.append("?")
    if superseded and superseded[0] == "superseded":
        return superseded
    if superseded:
        return superseded
    if amended:
        return "amended", "amended by " + ", ".join(amended)
    return "live", "live"


def parse_entries(path: str, text: str, *, whole_file: bool) -> tuple[list[Entry], int]:
    """Entries in `text`. whole_file=True (a range file): the first line must be an entry heading
    and every `## ` heading must be an entry or an addendum. whole_file=False (the pre-split
    DECISIONS.md): entries start at the first entry heading outside a code fence.
    Returns (entries, index of the line where entries start)."""
    lines = text.split("\n")
    entries: list[Entry] = []
    in_fence = False
    start: int | None = None
    current: Entry | None = None
    body_first: str | None = None
    marker: list[str] = []
    in_marker = True

    def finish() -> None:
        if current is None:
            return
        if not current.date:
            if body_first and ISO_DATE_RE.search(body_first):
                current.date = ISO_DATE_RE.search(body_first).group(1)
            else:
                raise DecError(f"{path}:{current.line}: {current.id} has no date — none in its heading "
                               f"and none in its first body line")
        current.kind, current.status = _status(marker)

    for i, ln in enumerate(lines):
        if ln.startswith("```"):
            in_fence = not in_fence
        if in_fence or ln.startswith("```"):
            if start is not None and current is not None:
                if body_first is None and ln.strip():
                    body_first = ln
                    in_marker = False
            continue
        m = ENTRY_RE.match(ln)
        if m:
            if start is None:
                start = i
            finish()
            heading = m.group(2)
            # The date is the one in the `(Emilio, 2026-10-31)` group; a date in the title itself
            # ("the 2026-10-30 barbell session") is not it.
            parens = DATE_PAREN_RE.findall(heading)
            dates = ISO_DATE_RE.findall(parens[-1] if parens else heading)
            title = re.sub(r"\s{2,}", " ", DATE_PAREN_RE.sub("", heading)).strip()
            current = Entry(int(m.group(1)), title, dates[0] if dates else "", path, i + 1)
            entries.append(current)
            body_first, marker, in_marker = None, [], True
            continue
        if start is None:
            if whole_file and ln.strip():
                raise DecError(f"{path}:{i + 1}: text before the first entry heading "
                               f"(a range file holds `## DEC-NNN — title  (date)` entries only): {ln!r}")
            continue
        if ADDENDUM_RE.match(ln):
            in_marker = False
            continue
        if DECISH_RE.match(ln) or (whole_file and ln.startswith("## ")):
            raise DecError(f"{path}:{i + 1}: malformed heading {ln!r} — an entry heading is "
                           f"`## DEC-NNN — title  (date)` (three digits, an em dash)")
        if current is not None and ln.strip():
            if in_marker and ln.startswith(">"):
                marker.append(ln)
            else:
                in_marker = False
                if body_first is None:
                    body_first = ln
    finish()
    if in_fence:
        raise DecError(f"{path}: an unclosed ``` code fence")
    return entries, (start if start is not None else len(lines))


def check_unique(entries: list[Entry]) -> None:
    seen: dict[int, Entry] = {}
    for e in entries:
        if e.num in seen:
            o = seen[e.num]
            raise DecError(f"{e.path}:{e.line}: {e.id} is a duplicate — also {o.path}:{o.line}")
        seen[e.num] = e


def parse_range_files(files: dict[str, str]) -> list[Entry]:
    """files: {basename: text} of handoff/log/decisions/*.md."""
    entries: list[Entry] = []
    for name in sorted(files):
        path = f"{DECISIONS_DIR}/{name}"
        if not RANGE_FILE_RE.match(name):
            raise DecError(f"{path}: not a range file name (DEC-NNN-NNN.md)")
        found, _ = parse_entries(path, files[name], whole_file=True)
        for e in found:
            if range_name(e.num) != name:
                raise DecError(f"{path}:{e.line}: {e.id} belongs in {DECISIONS_DIR}/{range_name(e.num)}")
        entries.extend(found)
    check_unique(entries)
    return sorted(entries, key=lambda e: e.num)


def parse_legacy(decisions_md: str) -> list[Entry]:
    """The pre-split layout: every entry inside DECISIONS.md."""
    entries, _ = parse_entries(DECISIONS_PATH, decisions_md, whole_file=False)
    check_unique(entries)
    return entries


def head_of(decisions_md: str) -> str:
    """The hand-written part of DECISIONS.md: everything before the index heading."""
    lines = decisions_md.split("\n")
    for i, ln in enumerate(lines):
        if ln == INDEX_HEADING:
            return "\n".join(lines[:i]) + "\n" if i else ""
    return decisions_md.rstrip("\n") + "\n\n"


def render_index(entries: list[Entry]) -> str:
    out = [
        INDEX_HEADING,
        "",
        f"Generated by `{REGEN_COMMAND}` from `log/decisions/*.md` — don't edit it; `./plan save` regenerates it.",
        "One line per DEC: id · date · title · status (from a `> SUPERSEDED by …` / `> AMENDED by …` marker at",
        "the entry's top; an amendment written only in prose stays `live`). The full entry is in the range file above it.",
    ]
    current_file = None
    for e in sorted(entries, key=lambda e: e.num):
        if e.path != current_file:
            current_file = e.path
            out += ["", f"### {e.path.removeprefix('handoff/log/')}", ""]
        out.append(f"- {e.id} · {e.date} · {e.title} · {e.status}")
    return "\n".join(out) + "\n"


def render(decisions_md: str, entries: list[Entry]) -> str:
    return head_of(decisions_md) + render_index(entries)


def digest_lines(decisions_md: str) -> list[tuple[int, str]]:
    """(1-based line, text) of the `## Current rules digest` section, up to the next `## `."""
    out: list[tuple[int, str]] = []
    inside = False
    for i, ln in enumerate(decisions_md.split("\n")):
        if ln.startswith("## "):
            if inside:
                break
            inside = ln.startswith(DIGEST_HEADING)
            continue
        if inside:
            out.append((i + 1, ln))
    return out


# ------------------------------------------------------------------ filesystem

def read_fs(root: str) -> tuple[str, dict[str, str] | None]:
    """(DECISIONS.md text, {range file: text} or None when not split yet)."""
    with open(os.path.join(root, DECISIONS_PATH), encoding="utf8", newline="") as f:
        decisions_md = f.read()
    d = os.path.join(root, DECISIONS_DIR)
    if not os.path.isdir(d):
        return decisions_md, None
    files = {}
    for name in sorted(os.listdir(d)):
        if name.endswith(".md"):
            with open(os.path.join(d, name), encoding="utf8", newline="") as f:
                files[name] = f.read()
    return decisions_md, files


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    help="repository root (default: this checkout)")
    ap.add_argument("--check", action="store_true", help="write nothing; exit 1 if the index is stale")
    args = ap.parse_args(argv)

    if not os.path.isfile(os.path.join(args.root, DECISIONS_PATH)):
        print(f"dec_index: no {DECISIONS_PATH} under {args.root} — nothing to index into", file=sys.stderr)
        return 2
    decisions_md, files = read_fs(args.root)
    if not files:
        print(f"dec_index: {DECISIONS_DIR}/ has no range files — not split yet; run python3 scripts/dec_split.py",
              file=sys.stderr)
        return 2
    try:
        entries = parse_range_files(files)
    except DecError as e:
        print(f"dec_index: refusing, nothing written — {e}", file=sys.stderr)
        return 2
    out = render(decisions_md, entries)
    if args.check:
        if out != decisions_md:
            print(f"dec_index: {DECISIONS_PATH}'s index is stale — run: {REGEN_COMMAND}", file=sys.stderr)
            return 1
        return 0
    if out != decisions_md:
        path = os.path.join(args.root, DECISIONS_PATH)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf8", newline="") as f:
            f.write(out)
        os.replace(tmp, path)
        print(f"dec_index: wrote the index — {len(entries)} entries")
    else:
        print(f"dec_index: index up to date — {len(entries)} entries")
    return 0


if __name__ == "__main__":
    sys.exit(main())
