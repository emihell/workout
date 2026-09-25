#!/usr/bin/env python3
"""req-160 — the skills under .claude/skills/ point at the rules; they don't copy them.

Two checks, exit 1 on any failure:
  1. every pointer in a SKILL.md resolves: `handoff/…`/`scripts/…` paths exist, each
     L-NNN / DEC-NNN has its `## ` entry, each §Section is a heading in one of the rule
     files (handoff/rules/*.md, handoff/PLANNING.md);
  2. no rule text is duplicated: no run of N (default 8) consecutive words of a skill
     body appears in handoff/**/*.md, CLAUDE.md or README.md. A run containing a path
     (a `/` inside a word) is a pointer, not rule text, and is skipped.

  python3 scripts/check_skills.py [--skills-dir DIR] [--words N]
Self-test: scripts/check-skills.test.sh.
"""
import argparse
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def words(text):
    return re.sub(r"[^a-z0-9\-\./§]+", " ", text.lower()).split()


def runs(ws, n):
    return {" ".join(ws[i : i + n]) for i in range(len(ws) - n + 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skills-dir", default=os.path.join(ROOT, ".claude/skills"))
    ap.add_argument("--words", type=int, default=8)
    args = ap.parse_args()
    os.chdir(ROOT)

    headings = "\n".join(
        line
        for f in glob.glob("handoff/rules/*.md") + ["handoff/PLANNING.md"]
        if os.path.exists(f)
        for line in open(f, encoding="utf8")
        if line.startswith("#")
    )
    lessons = open("handoff/log/LESSONS.md", encoding="utf8").read()
    decisions = open("handoff/log/DECISIONS.md", encoding="utf8").read()
    rule_runs = set()
    for f in glob.glob("handoff/**/*.md", recursive=True) + ["CLAUDE.md", "README.md"]:
        rule_runs |= runs(words(open(f, encoding="utf8").read()), args.words)

    skills = sorted(glob.glob(os.path.join(args.skills_dir, "*/SKILL.md")))
    if not skills:
        print(f"check_skills: no SKILL.md under {args.skills_dir} — refusing to pass.", file=sys.stderr)
        return 2
    failures = 0
    for f in skills:
        name = os.path.basename(os.path.dirname(f))
        body = open(f, encoding="utf8").read().split("---", 2)[-1]
        bad = []
        for p in set(re.findall(r"`((?:handoff|scripts)/[^`<*\s]+)`", body)):
            if not os.path.exists(p):
                bad.append(f"path {p} does not exist")
        for lid in set(re.findall(r"\bL-\d{3}\b", body)):
            if f"## {lid} " not in lessons:
                bad.append(f"{lid} has no entry in LESSONS.md")
        for did in set(re.findall(r"\bDEC-\d{3}\b", body)):
            if f"## {did} " not in decisions:
                bad.append(f"{did} has no entry in DECISIONS.md")
        for sec in set(re.findall(r"§([A-Z][A-Za-z ,'\-]+?)(?=[,;.:)(`]| —| step| check|\n|$)", body)):
            if not re.search(r"^#+ .*" + re.escape(sec.strip()), headings, re.M):
                bad.append(f"§{sec.strip()} is not a heading in the rule files")
        copied = sorted(r for r in runs(words(body), args.words) & rule_runs if not any("/" in w for w in r.split()))
        bad += [f'copied rule text: "{r}"' for r in copied]
        print(f"check_skills: {name:15} {'ok' if not bad else 'FAIL'}")
        for b in bad:
            print(f"    {b}")
        failures += bool(bad)
    print(f"check_skills: {len(skills)} skill(s), {failures} failing")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
