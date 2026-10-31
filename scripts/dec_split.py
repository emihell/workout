#!/usr/bin/env python3
"""req-271 — split handoff/log/DECISIONS.md's entries into range files of 50. A move, never a rewrite.

  handoff/log/DECISIONS.md         keeps everything above the first entry (header, format example,
                                   digest) byte for byte, and gains the generated index (dec_index.py)
  handoff/log/decisions/DEC-001-050.md, DEC-051-100.md, …   the entries, cut at entry headings;
                                   an addendum heading (`## DEC-035 follow-up`) moves with its entry

Then it proves the move, from the files as written (or, with --dry-run, as they would be):
the range files concatenated in order are byte-equal to the entry text before; every `## `
heading of the old file is in exactly one new file; the index matches dec_index.py's output.
Any failed proof exits 1. Refuses (exit 2, nothing written) if decisions/ already holds a file,
or on anything dec_index.py refuses.

  python3 scripts/dec_split.py [--root DIR] [--dry-run]
"""
from __future__ import annotations

import argparse
import hashlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dec_index as di  # noqa: E402


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf8")).hexdigest()[:16]


def _headings(text: str) -> list[str]:
    return [ln for ln in text.split("\n") if ln.startswith("## ")]


def plan_split(decisions_md: str) -> tuple[str, str, dict[str, str], list[di.Entry]]:
    """(header, entry text, {range file: text}, entries) — computed, nothing written."""
    entries, start = di.parse_entries(di.DECISIONS_PATH, decisions_md, whole_file=False)
    di.check_unique(entries)
    if not entries:
        raise di.DecError(f"{di.DECISIONS_PATH}: no entry headings found")
    lines = decisions_md.split("\n")
    header = "\n".join(lines[:start]) + "\n"
    body = "\n".join(lines[start:])
    # Cut at each entry heading (1-based line → 0-based index); the slice up to the next entry is its
    # file's. An addendum isn't an entry heading, so it stays inside the slice of the entry above it.
    cuts = [e.line - 1 for e in entries] + [len(lines)]
    files: dict[str, list[str]] = {}
    for e, a, b in zip(entries, cuts, cuts[1:]):
        chunk = lines[a:b]
        files.setdefault(di.range_name(e.num), []).append("\n".join(chunk))
    # Every chunk but the last ends where the next begins, so a "\n" joins them back.
    texts = {name: "\n".join(chunks) for name, chunks in files.items()}
    ordered = sorted(texts)
    for name in ordered[:-1]:
        texts[name] += "\n"
    return header, body, texts, entries


def prove(before: str, header: str, body: str, decisions_md: str, files: dict[str, str]) -> list[str]:
    """Failures (empty = proven). Reads only the texts passed in."""
    fails = []
    after = "".join(files[n] for n in sorted(files))
    if after != body:
        fails.append(f"entry text differs: before {len(body)} bytes sha {_sha(body)}, "
                     f"after {len(after)} bytes sha {_sha(after)}")
    if header + body != before:
        fails.append("header + entry text is not the original file")
    if not decisions_md.startswith(header):
        fails.append("DECISIONS.md does not keep the header byte for byte")
    where: dict[str, list[str]] = {}
    for name, text in [("DECISIONS.md(header)", header)] + [(n, files[n]) for n in sorted(files)]:
        for h in _headings(text):
            where.setdefault(h, []).append(name)
    for h in _headings(before):
        n = len(where.get(h, []))
        if n != _headings(before).count(h):
            fails.append(f"heading {h!r} is in {n} file(s), was {_headings(before).count(h)}")
    try:
        entries = di.parse_range_files(files)
    except di.DecError as e:
        fails.append(f"the range files don't parse: {e}")
    else:
        if di.render(decisions_md, entries) != decisions_md:
            fails.append("DECISIONS.md's index is not dec_index.py's output")
    return fails


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ap.add_argument("--dry-run", action="store_true", help="compute and prove, write nothing")
    args = ap.parse_args(argv)

    dpath = os.path.join(args.root, di.DECISIONS_PATH)
    ddir = os.path.join(args.root, di.DECISIONS_DIR)
    if os.path.isdir(ddir) and any(n.endswith(".md") for n in os.listdir(ddir)):
        print(f"dec_split: refusing — {di.DECISIONS_DIR}/ already holds range files; already split?", file=sys.stderr)
        return 2
    with open(dpath, encoding="utf8", newline="") as f:
        before = f.read()
    try:
        header, body, files, _ = plan_split(before)
        new_md = di.render(header, di.parse_range_files(files))
    except di.DecError as e:
        print(f"dec_split: refusing, nothing written — {e}", file=sys.stderr)
        return 2

    if not args.dry_run:
        os.makedirs(ddir, exist_ok=True)
        for name, text in files.items():
            with open(os.path.join(ddir, name), "w", encoding="utf8", newline="") as f:
                f.write(text)
        with open(dpath, "w", encoding="utf8", newline="") as f:
            f.write(new_md)
        # Prove from disk, not from memory.
        new_md, read_back = di.read_fs(args.root)
        files = read_back or {}

    fails = prove(before, header, body, new_md, files)
    mode = "dry run (nothing written)" if args.dry_run else "written"
    print(f"dec_split: {mode}")
    print(f"  before   {di.DECISIONS_PATH}: {before.count(chr(10))} lines, {len(before.encode())} bytes, "
          f"{len(_headings(before))} `## ` headings, {sum(h.startswith('## DEC-') for h in _headings(before))} of them `## DEC-` "
          f"({len(_headings(header))} `## ` in the header, kept there)")
    print(f"  entries  {body.count(chr(10))} lines, {len(body.encode())} bytes, sha256 {_sha(body)}")
    after = "".join(files[n] for n in sorted(files))
    print(f"  after    concatenated range files: {len(after.encode())} bytes, sha256 {_sha(after)} "
          f"→ {'byte-equal' if after == body else 'DIFFERENT'}")
    for n in sorted(files):
        hs = _headings(files[n])
        print(f"  {di.DECISIONS_DIR}/{n}: {files[n].count(chr(10))} lines, {len(hs)} headings "
              f"({hs[0][3:10]}..{[h for h in hs if di.ENTRY_RE.match(h)][-1][3:10]})")
    print(f"  {di.DECISIONS_PATH}: {new_md.count(chr(10))} lines "
          f"(header {header.count(chr(10))} + index {new_md.count(chr(10)) - header.count(chr(10))})")
    total = len(_headings(header)) + sum(len(_headings(t)) for t in files.values())
    print(f"  headings after: {total} (header {len(_headings(header))} + range files "
          f"{total - len(_headings(header))}); each in exactly one file: {'yes' if not fails else 'see below'}")
    for f_ in fails:
        print(f"  FAIL {f_}")
    print(f"dec_split: {'proven' if not fails else 'NOT proven'}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
