"""req-34: stop hand-copying what git already knows.

Two checks, one command — folded into `./plan status` and `./plan
publish` rather than a new `plan check`, since the failure mode this
fixes is "nobody ran the check", not "there's no check to run":

  1. every requirement's `Status:` line against what git can actually see
     (a merge commit, a direct commit, or an explicit hash already in the
     tag), and against `NOW.md`'s own queue where it mentions the same
     requirement.
  2. every size claim in `handoff/` ("N lines", or a same-file ranking
     like "second longest") against a real `wc -l` — except `NOW.md`'s
     own "keep this under 50 lines", which is a rule to enforce, not a
     fact to verify.

Later additions: NOW.md carries exactly one `**Next:**` line (req-250), and
a SHIPPED entry dated after 2026-10-30 with more than 3 body lines warns
(req-252; a warning, never a failure). The doc-size ratchet (req-272): each rule doc in
scripts/doc_limits.json at or under its ceiling — over it fails; ≥10 % under warns "tighten".

(A former backlog-index check — `## Sections` / `### N.N` against
`work/backlog/tier-*.md` — was retired in req-102 when that structure
was abandoned; see the note where it stood.)

No auto-correction anywhere (`req-27`'s reasoning: a human changes the
code when a contract breaks — a script that silently rewrote a `Status:`
line would make the tag agree with git while telling nobody the work had
shipped). Reads git objects only — this never touches the working tree,
so it can be pointed at any ref, including one from months ago, without
checking anything out.

    python3 scripts/check_handoff.py [--repo PATH] [--ref REF]

Exit 0 with no output when everything is consistent. Exit 1, with every
finding printed, otherwise.
"""
from __future__ import annotations

import argparse
import functools
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

WORK_DIR = "handoff/work"
BACKLOG_PATH = "handoff/work/BACKLOG.md"
NOW_MD_PATH = "handoff/NOW.md"


# ---------------------------------------------------------------- git access
# Every read goes through git itself (show / ls-tree / log), never the
# filesystem directly — the one thing that makes `--ref` meaningful for a
# commit from months ago, and the one thing that guarantees criterion 7
# ("reads handoff/, writes nothing").

def _git(repo: str, args: list[str]) -> str:
    result = subprocess.run(
        ["git", "-C", repo] + args,
        capture_output=True,
        text=True,
    )
    return result.stdout


def read_file(repo: str, ref: str, path: str) -> str | None:
    result = subprocess.run(
        ["git", "-C", repo, "show", f"{ref}:{path}"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None
    return result.stdout


def list_files(repo: str, ref: str, path: str) -> list[str]:
    out = _git(repo, ["ls-tree", "-r", "--name-only", ref, "--", path])
    return [line for line in out.splitlines() if line]


def line_count(repo: str, ref: str, path: str) -> int | None:
    """Matches real `wc -l`: a count of newline characters, not "lines a
    human would count" — identical either way unless a file is missing
    its final trailing newline, in which case `wc -l` is one short, and
    so is this."""
    content = read_file(repo, ref, path)
    if content is None:
        return None
    return content.count("\n")


def is_ancestor(repo: str, commit: str, ref: str) -> bool:
    result = subprocess.run(
        ["git", "-C", repo, "merge-base", "--is-ancestor", commit, ref],
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def _touches_code(repo: str, commit_hash: str) -> bool:
    """A commit that only edits `handoff/` is the planning session writing
    or updating the requirement's own document — not evidence the code
    shipped. Real landing commits (merge or direct) always touch
    something outside `handoff/` too."""
    changed = _git(repo, ["show", "--name-only", "--format=", commit_hash])
    return any(p.strip() and not p.startswith("handoff/") for p in changed.splitlines())


# `find_merge_evidence` runs once per requirement (~35 of them). Re-running
# `git log` over the whole history and re-diffing every candidate commit
# each time is most of this tool's runtime (criterion 8: under two
# seconds) — fetched once per (repo, ref) and reused instead.
@functools.lru_cache(maxsize=None)
def _merge_commit_subjects(repo: str, ref: str) -> tuple[tuple[str, str], ...]:
    out = _git(repo, ["log", ref, "--format=%H\t%s", "--merges"])
    return tuple(line.split("\t", 1) for line in out.splitlines() if line)


@functools.lru_cache(maxsize=None)
def _all_commit_subjects(repo: str, ref: str) -> tuple[tuple[str, str], ...]:
    out = _git(repo, ["log", ref, "--format=%H\t%s"])
    return tuple(line.split("\t", 1) for line in out.splitlines() if line)


@functools.lru_cache(maxsize=None)
def _touches_code_cached(repo: str, commit_hash: str) -> bool:
    return _touches_code(repo, commit_hash)


def find_merge_evidence(repo: str, ref: str, slug: str, reqid: str) -> str | None:
    """A merge commit for `slug`'s branch, or — the direct-commit case,
    req-28 landed as `49784fa` with no merge commit at all — any commit
    whose subject references `reqid` as its own (a leading "req-28:" or
    "feat(req-03):", not an incidental mention elsewhere in a longer
    message). Either way it has to actually touch code — the planning
    session's own commits describing or introducing a requirement share
    the same "req-NN ..." subject convention but only ever touch
    `handoff/`, and are not evidence anything shipped."""
    for commit_hash, subject in _merge_commit_subjects(repo, ref):
        if f"Merge branch '{slug}'" in subject and _touches_code_cached(repo, commit_hash):
            return commit_hash
    direct_re = re.compile(rf"(^|\()({re.escape(reqid)})(:|\)|\s|$)")
    for commit_hash, subject in _all_commit_subjects(repo, ref):
        if direct_re.search(subject) and _touches_code_cached(repo, commit_hash):
            return commit_hash
    return None


# ------------------------------------------------------------------ finding

@dataclass
class Finding:
    check: str        # "status" | "status-unknown" | "size"
    severity: str      # "fail" | "warn" | "info" | "unknown"
    subject: str       # e.g. "req-08", "app/static/style.css"
    message: str

    def __str__(self) -> str:
        return f"[{self.severity}] {self.check}: {self.subject} — {self.message}"


# --------------------------------------------------------- check 1: status

STATUS_RE = re.compile(r"\*\*Status:\s*(.*?)\*\*", re.S)
HASH_RE = re.compile(r"`([0-9a-f]{7,40})`")
BLOCKED_RE = re.compile(r"BLOCKED ON `?(req-\d+)")
REQ_FILE_RE = re.compile(r"^req-(\d+)-.*\.md$")
REQ_FOLDER_RE = re.compile(r"^req-(\d+)-")


@dataclass
class ReqTag:
    slug: str
    reqid: str
    path: str
    tag_text: str
    head: str = ""  # req-166: the doc's first lines, where the Lane / legacy Gate tag sits


# req-166 (DEC-085 §6) — a requirement names its lane: `**Lane: <lane>**` (a trailing `.`
# or a following note is fine: `**Lane: tooling.**`, `**Lane: bug** (small)`). Old reqs
# keep their legacy Gate tag (`Gate: …` or a bold `**[…]**` tag).
LANES = ("ui", "bug", "data", "content", "design", "backend", "tooling", "audit")
LANE_RE = re.compile(r"\*\*Lane:\s*([^*\s.]+)")
LEGACY_GATE_RE = re.compile(r"\bGate:|\*\*\[")


def find_requirement_tags(repo: str, ref: str) -> list[ReqTag]:
    entries = list_files(repo, ref, WORK_DIR)
    prefix = WORK_DIR + "/"
    top_level: list[str] = []
    folders: set[str] = set()
    for p in entries:
        rel = p[len(prefix):] if p.startswith(prefix) else p
        parts = rel.split("/")
        if len(parts) == 1 and REQ_FILE_RE.match(parts[0]):
            top_level.append(p)
        elif len(parts) > 1 and REQ_FOLDER_RE.match(parts[0]):
            folders.add(parts[0])

    candidates: list[tuple[str, str, str]] = []
    for p in sorted(top_level):
        slug = Path(p).stem
        reqid = "-".join(slug.split("-")[:2])
        candidates.append((slug, reqid, p))
    for folder in sorted(folders):
        slug = folder
        reqid = "-".join(folder.split("-")[:2])
        candidates.append((slug, reqid, f"{WORK_DIR}/{folder}/README.md"))

    out = []
    for slug, reqid, path in candidates:
        content = read_file(repo, ref, path)
        if content is None:
            continue
        # The tag starts on line 3 by convention; a short multi-line
        # window tolerates a description that wraps before its closing
        # `**` without hard-coding to a single physical line.
        window = "\n".join(content.splitlines()[:6])
        m = STATUS_RE.search(window)
        out.append(ReqTag(slug=slug, reqid=reqid, path=path, tag_text=m.group(1) if m else "", head=window))
    return out


def classify_tag(tag_text: str) -> tuple[str, str | None]:
    """One of 'merged' | 'not-merged' | 'blocked' | 'decided' | 'unknown', plus a hash
    (for 'merged') or a blocking reqid (for 'blocked') when present."""
    # req-166 (DEC-085 §6) — a design req ends `DECIDED <date> → DEC-…, req-…`: terminal,
    # nothing to merge (a design req has no branch).
    if re.search(r"\bDECIDED\s+\d{4}-\d{2}-\d{2}\s*(→|->)", tag_text):
        return ("decided", None)
    if re.search(r"BUILT AND (MERGED|VERIFIED)", tag_text):
        m = HASH_RE.search(tag_text)
        return ("merged", m.group(1) if m else None)
    if re.search(r"\bSHELVED\b|\bWITHDRAWN\b", tag_text):
        return ("unknown", None)
    m = BLOCKED_RE.search(tag_text)
    if m:
        return ("blocked", m.group(1))
    # "NEEDS DECISIONS?" matches both the singular the docs actually write
    # ("Status: NEEDS DECISION") and the plural (req-102 Fix 2); the plural-only
    # pattern left every parked req classified 'unknown' instead of 'not-merged'.
    if re.search(r"\bREADY\b|\bNEEDS DECISIONS?\b", tag_text):
        return ("not-merged", None)
    # req-139: a "BUILT … NOT YET MERGED (branch req-N)" or "BUILT, …
    # awaiting merge" tag reached here because it isn't BUILT AND
    # (MERGED|VERIFIED) — everything BUILT-and-shipped, SHELVED, WITHDRAWN
    # or BLOCKED was classified above, so a remaining BUILT (or an explicit
    # unmerged phrase) is a claim of not-yet-merged, and gets the reverse
    # check that fires only when git shows the branch *is* on `main`. Broad
    # by design (DEC on Emilio's behalf, unconfirmed): safe because a
    # genuinely-unmerged BUILT doc produces no finding.
    if re.search(r"\bBUILT\b", tag_text) or re.search(
        r"NOT YET MERGED|awaiting merge|not merged|unmerged", tag_text, re.I
    ):
        return ("not-merged", None)
    return ("unknown", None)


DONE_LINE_RE = re.compile(r"^done \d{4}-\d{2}-\d{2}:\s*(.+)$", re.M)
QUEUE_LINE_RE = re.compile(r"^\s*\[.\]\s*(req-\d+)\b.*?\b(READY|SHELVED|WITHDRAWN|BLOCKED)\b", re.M)
REQID_RE = re.compile(r"req-\d+")

# ---- section-aware scan of NOW.md's free prose (req-101, from L-020) -------
# The old DONE_LINE_RE/QUEUE_LINE_RE above expect a "done <date>:" /
# "[ ] req-N ... TAG" format NOW.md no longer writes, so on the current doc
# they match nothing and the whole cross-check silently ran on {} — a shipped
# req sat under a "NEEDS DECISION" line for a session and the check stayed
# green (L-020: a rotted check is worse than none). They're kept in case those
# formats return; the scan below is what actually reads today's prose.
#
# It keys off NOW.md's *stable structure*, not a checkbox format: a req-N under
# a FORWARD-LOOKING region (a section/label that declares work not yet shipped)
# is a "pending" claim — NOW.md asserting that req has not landed. Everything
# else (the top "**Shipped: ...**" summary, "LIVE"/aftermath notes,
# "## Milestone", "## Where to read") legitimately names shipped reqs and is
# never scanned. Forward-looking regions in the current NOW.md: the
# "## Needs decisions — parked" section, the "**READY, held:**" block, and the
# "**IN FLIGHT:**" line.
NOW_HEADER_RE = re.compile(r"^\s*#{1,6}\s")
NEEDS_DECISION_HEADER_RE = re.compile(r"^\s*#{1,6}\s.*\bneeds decisions?\b", re.I)
# A short bold label that OPENS a forward-looking block. The bold content must
# *start* with the label word, so "**IN FLIGHT:**" / "**READY, held:**" open
# one but a sentence merely containing the words — "**Nothing in flight.**",
# which names shipped reqs — does not. Punctuation after the word isn't
# hardcoded (the \b handles the ":" / "," that follow).
FORWARD_LABEL_RE = re.compile(r"^\s*\*\*\s*(?:READY\b|IN\s+FLIGHT\b)", re.I)
BOLD_LINE_RE = re.compile(r"^\s*\*\*")


def parse_now_md_claims(now_md_text: str) -> dict[str, str]:
    """reqid -> "merged" | "ready" | "shelved" | "withdrawn" | "blocked" |
    "pending", read from NOW.md's own statements about each req.

    Two layers, both best-effort (NOW.md is free prose, not a table — this is
    the softest part of check 1 by design, so it only ever adds a finding on a
    clear mismatch, never on a req it can't confidently place):

      * legacy explicit formats, kept in case they return — "done <date>:
        req-N" lines (merged) and "[ ] req-N ... TAG" queue lines;
      * a section-aware scan (see the block comment above) — a req-N under a
        forward-looking region is a "pending" claim (NOW.md says it hasn't
        shipped). An explicit claim from the layer above wins over a scanned
        one (setdefault).
    """
    claims: dict[str, str] = {}
    for m in DONE_LINE_RE.finditer(now_md_text):
        for reqid in REQID_RE.findall(m.group(1)):
            claims[reqid] = "merged"
    for m in QUEUE_LINE_RE.finditer(now_md_text):
        claims[m.group(1)] = m.group(2).lower()

    # Two independent "we are inside a forward-looking region" signals:
    #   * a "## Needs decisions" section — holds until the next ## header;
    #   * a bold-label block ("**IN FLIGHT:**", "**READY, held:**") — holds
    #     until a blank line, a new header, or a new bold label (a bold line
    #     whose label is NOT forward-looking, e.g. "**Gym-flow batch 2 …**"
    #     naming LIVE reqs, closes the block and is itself not scanned).
    in_needs_decision = False
    in_forward_block = False
    for line in now_md_text.splitlines():
        if NOW_HEADER_RE.match(line):
            in_needs_decision = bool(NEEDS_DECISION_HEADER_RE.match(line))
            in_forward_block = False
            continue
        if line.strip() == "":
            in_forward_block = False
            continue
        if BOLD_LINE_RE.match(line):
            in_forward_block = bool(FORWARD_LABEL_RE.match(line))
        if in_needs_decision or in_forward_block:
            # req-102 Fix 3: claim only the FIRST req-N on the line — the
            # bullet's subject, in practice the backticked token that opens it —
            # not every mention. An incidental cross-reference on the same line
            # ("`req-102` … (from req-101 item #3)") otherwise made the scan
            # claim the *referenced* req (req-101, already merged) as 'pending',
            # a false finding — the exact bug the req-101 ledger hit. Tradeoff:
            # a single bullet that legitimately introduces two new reqs claims
            # only the first; accepted (spec) as the right call vs. false
            # positives on cross-refs.
            subject = REQID_RE.search(line)
            if subject:
                claims.setdefault(subject.group(0), "pending")
    return claims


def _now_claim_disagrees(category: str, now_claim: str) -> bool:
    # req-166 — a DECIDED design req is finished like a merged one (nothing to merge).
    if now_claim == "merged":
        return category not in ("merged", "decided")
    if now_claim == "ready":
        return category != "not-merged"
    if now_claim in ("shelved", "withdrawn"):
        return category != "unknown"
    if now_claim == "blocked":
        return category != "blocked"
    if now_claim == "pending":
        # A forward-looking placement only contradicts the doc when the doc
        # says the work actually shipped. "unknown" (can't place it), still
        # "not-merged", or "blocked" are all consistent with "not shipped
        # yet" — stay silent. This is the whole conservative bargain.
        return category in ("merged", "decided")
    return False


def check_lane(tag: ReqTag, category: str) -> list[Finding]:
    """req-166 — a Lane tag must name a known lane (else fail). An OPEN req (not merged,
    decided, shelved or withdrawn) with neither a Lane nor a legacy Gate warns: it is about
    to be built without its gate named. Finished docs are history and are not flagged —
    55 of them predate Gate tags, and a warning each on every run would be noise."""
    m = LANE_RE.search(tag.head)
    if m:
        lane = m.group(1).lower()
        if lane not in LANES:
            return [Finding("lane", "fail", tag.reqid, f"unknown Lane {m.group(1)!r} (expected one of {', '.join(LANES)})")]
        return []
    if LEGACY_GATE_RE.search(tag.head) or category in ("merged", "decided", "unknown"):
        return []
    return [Finding("lane", "warn", tag.reqid, "no **Lane: …** tag (and no legacy Gate) — name its lane (WORKFLOW §Requirement lanes)")]


def check_status_lines(repo: str, ref: str) -> list[Finding]:
    findings: list[Finding] = []
    tags = find_requirement_tags(repo, ref)
    by_reqid = {t.reqid: t for t in tags}
    now_md_text = read_file(repo, ref, NOW_MD_PATH) or ""
    now_claims = parse_now_md_claims(now_md_text)

    for tag in tags:
        category, extra = classify_tag(tag.tag_text)
        findings.extend(check_lane(tag, category))

        # Checked first, for every category: the merged/blocked/unknown
        # branches below each `continue`, so a claim check left at the tail of
        # the loop (as it was) never ran for a merged req — exactly the drift
        # req-101 exists to catch (NOW.md lists req-N as pending while its doc
        # is BUILT AND MERGED). _now_claim_disagrees stays conservative, so
        # this only fires on a real contradiction.
        now_claim = now_claims.get(tag.reqid)
        if now_claim and _now_claim_disagrees(category, now_claim):
            findings.append(Finding(
                "status", "fail", tag.reqid,
                f"NOW.md lists {tag.reqid} as {now_claim!r}, but its own doc tag implies {category!r}",
            ))

        if category == "merged":
            if extra:
                if not is_ancestor(repo, extra, ref):
                    findings.append(Finding(
                        "status", "fail", tag.reqid,
                        f"tagged merged at `{extra}`, but that commit is not in {ref}'s history",
                    ))
            else:
                if not find_merge_evidence(repo, ref, tag.slug, tag.reqid):
                    findings.append(Finding(
                        "status", "fail", tag.reqid,
                        f"tagged merged but no merge or direct commit for it was found in {ref}",
                    ))
            continue

        if category == "not-merged":
            evidence = find_merge_evidence(repo, ref, tag.slug, tag.reqid)
            if evidence:
                findings.append(Finding(
                    "status", "fail", tag.reqid,
                    f"tagged not-yet-merged, but {evidence[:7]} already merges it",
                ))
                continue

        elif category == "blocked":
            blocker = by_reqid.get(extra or "")
            if blocker is not None:
                blocker_category, _ = classify_tag(blocker.tag_text)
                if blocker_category == "merged":
                    findings.append(Finding(
                        "status", "fail", tag.reqid,
                        f"blocked on {extra}, which is already tagged merged",
                    ))
                    continue

        elif category == "decided":
            continue

        elif category == "unknown":
            findings.append(Finding(
                "status", "unknown", tag.reqid,
                "cannot determine merge status from this tag (shelved/withdrawn/unparseable) — not a failure",
            ))
            continue

    return findings


# req-102: the former check 2, a backlog-index validator, is retired. It checked a
# `## Sections` / `**§N.N**` / `### N.N` index against `### N.N` headings in
# `handoff/work/backlog/tier-*.md`, but that structure was deliberately abandoned
# — the tier dir no longer exists and BACKLOG.md is now a prose index
# (CLAUDE.md: "BACKLOG.md is an index, not the backlog"). Unlike the L-020
# family, the thing it enforced is gone by design, so it was removed rather than
# repaired (Emilio, 2026-09-18) along with the constants used only by it
# (TIER_DIR, SECTION_HEADING_RE, UNNUMBERED_HEADING_RE, INDEX_ENTRY_RE).


# --------------------------------------------------------------- check 3: size
#
# Scoped to the handful of documents whose whole job is describing *current*
# state — NOW.md's rule, README.md's map, BACKLOG.md's index, AUDIT.md's
# checklist. Deliberately excludes `log/DECISIONS.md` and `log/LESSONS.md`:
# those are append-only historical records (README.md's own words) — a
# measurement quoted inside a dated DEC-/L- entry is describing that entry's
# moment, not asserting today's reality, and is correctly frozen. Same
# reasoning excludes old per-requirement docs and `reference/`. Without this
# scope, the same "N lines" shape matches dozens of these historical
# mentions and buries the handful that are genuinely live claims.

NOW_MD_RULE_LIMIT = 50
LIVING_DOCS = (NOW_MD_PATH, "handoff/README.md", BACKLOG_PATH, "handoff/rules/AUDIT.md")

FILENAME_TOKEN_RE = re.compile(r"[\w./-]*[\w-]\.(?:py|css|js|html|md|txt)\b")
NUM_LINES_RE = re.compile(r"(\d[\d,]*)\s+lines\b")
# "NOW.md ≤ 50 lines" is a threshold restated about a rule that already has
# its own dedicated check above — not a second, independent fact to verify
# for exact equality. Any of these immediately before the number means "skip
# it here", not "flag it here too".
THRESHOLD_RE = re.compile(r"(≤|<=|<|\bunder\b|\bat most\b|\bno more than\b)\s*$", re.I)
RANKING_RE = re.compile(
    r"\b(first|second|third|fourth|fifth|sixth)\s+(longest|shortest)\s+file\s+in\s+`?handoff/?`?",
    re.I,
)
ORDINALS = {"first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5, "sixth": 6}


def _resolve_path(claimed: str, index: dict[str, list[str]]) -> str | None:
    claimed = claimed.strip("`")
    candidates = index.get(Path(claimed).name, [])
    for c in candidates:
        if c == claimed or c.endswith("/" + claimed):
            return c
    if len(candidates) == 1:
        return candidates[0]
    return None


def check_size_claims(repo: str, ref: str) -> list[Finding]:
    findings: list[Finding] = []

    now_md_lines = line_count(repo, ref, NOW_MD_PATH)
    if now_md_lines is not None and now_md_lines > NOW_MD_RULE_LIMIT:
        findings.append(Finding(
            "size", "fail", NOW_MD_PATH,
            f"is {now_md_lines} lines — its own rule is ≤ {NOW_MD_RULE_LIMIT}",
        ))

    all_files = list_files(repo, ref, ".")
    path_index: dict[str, list[str]] = {}
    for p in all_files:
        path_index.setdefault(Path(p).name, []).append(p)

    # The ranking check needs every handoff/*.md file's real length to
    # compute an actual rank, even though only the LIVING_DOCS are ever
    # scanned *for* a ranking claim.
    handoff_md_files = [p for p in all_files if p.startswith("handoff/") and p.endswith(".md")]
    handoff_line_counts: dict[str, int] = {}

    for doc_path in LIVING_DOCS:
        text = read_file(repo, ref, doc_path)
        if text is None:
            continue
        for lineno, line in enumerate(text.splitlines(), start=1):
            # Pair each filename with the nearest "N lines" that follows
            # it and precedes the *next* filename on the line — not just
            # "the first number anywhere on the line", which would let an
            # unrelated file borrow another one's line count when a line
            # names more than one (AUDIT.md's "`NOW.md` ≤ 50 lines,
            # `CLAUDE.md` ≤ 200" is exactly this: one real "N lines"
            # phrase, two filenames, and only the first owns it).
            fname_matches = list(FILENAME_TOKEN_RE.finditer(line))
            num_matches = list(NUM_LINES_RE.finditer(line))
            for i, fname_match in enumerate(fname_matches):
                claimed_name = fname_match.group(0)
                window_end = fname_matches[i + 1].start() if i + 1 < len(fname_matches) else len(line)
                num_match = next(
                    (m for m in num_matches if fname_match.end() <= m.start() < window_end),
                    None,
                )
                if not num_match:
                    continue
                if THRESHOLD_RE.search(line[:num_match.start()]):
                    continue  # "NOW.md ≤ 50 lines" restates a rule, not a fact to verify
                if doc_path == NOW_MD_PATH and Path(claimed_name).name == "NOW.md":
                    continue  # the rule above already covers NOW.md about itself
                resolved = _resolve_path(claimed_name, path_index)
                if resolved is None:
                    continue
                claimed_n = int(num_match.group(1).replace(",", ""))
                actual_n = line_count(repo, ref, resolved)
                if actual_n is None or actual_n == claimed_n:
                    continue
                findings.append(Finding(
                    "size", "fail", f"{doc_path}:{lineno}",
                    f"claims {resolved} is {claimed_n} lines, actually {actual_n}",
                ))

        # A ranking claim ("the second longest file in `handoff/`") is
        # ordinary wrapped prose — the ordinal and "longest"/"shortest"
        # can land on different physical lines, so this runs over the
        # whole document rather than line by line like the pass above.
        for rank_match in RANKING_RE.finditer(text):
            ordinal_word, direction = rank_match.group(1).lower(), rank_match.group(2).lower()
            claimed_rank = ORDINALS[ordinal_word]
            lineno = text.count("\n", 0, rank_match.start()) + 1
            # A passage that corrects itself in the same breath ("An
            # earlier version named X as the second longest; it is
            # fifth") is the documented lesson this very check exists to
            # replace, not a live claim to re-flag forever — it repeats
            # the old wrong wording on purpose, to explain what changed.
            # Recognise it structurally (an ordinal appears again within
            # a short span right after) rather than trying to strip out
            # this one paragraph by hand.
            after = text[rank_match.end():rank_match.end() + 60]
            if re.search(r"\b(is|was)\s+(" + "|".join(ORDINALS) + r")\b", after, re.I):
                continue
            # The file being ranked ("it") is named earlier in the same
            # sentence/bullet, not necessarily on the same line — prose
            # wraps. Take the *closest* preceding backticked filename, not
            # the first one in a fixed-size window: AUDIT.md names two
            # files in the two bullets right before this claim, and the
            # nearer one (in the same bullet) is the one "it" refers to.
            preceding = text[max(0, rank_match.start() - 300):rank_match.start()]
            name_matches = list(re.finditer(r"`([\w./-]+\.md)`", preceding))
            if not name_matches:
                continue
            name_match = name_matches[-1]
            if not handoff_line_counts:
                for p in handoff_md_files:
                    n = line_count(repo, ref, p)
                    if n is not None:
                        handoff_line_counts[p] = n
            ranked = sorted(handoff_line_counts.items(), key=lambda kv: kv[1], reverse=(direction == "longest"))
            resolved = _resolve_path(name_match.group(1), path_index)
            if resolved is None or resolved not in handoff_line_counts:
                continue
            actual_rank = next((i for i, (p, _) in enumerate(ranked, start=1) if p == resolved), None)
            if actual_rank is not None and actual_rank != claimed_rank:
                findings.append(Finding(
                    "size", "fail", f"{doc_path}:{lineno}",
                    f"claims {resolved} is the {ordinal_word} {direction} file in handoff/, "
                    f"actually #{actual_rank} ({ranked[actual_rank - 1][1]} lines)",
                ))

    return findings


# ------------------------------------------------- check 3: NOW.md's Next line

# req-250 (DEC-144 §1) — every closeout is a clean point, and `./plan next` prints the
# resume line from NOW.md's `**Next:**` paragraph on main: the `**Next:**` line plus the
# lines after it up to a blank line or one starting `#`, `- ` or `**`, joined (req-253). So
# NOW.md must carry exactly one line starting `**Next:**`: none and `plan next` has nothing
# to print, two and it can't tell which is current. A missing NOW.md is not this check's to
# report.
NEXT_LINE_PREFIX = "**Next:**"


def check_next_line(repo: str, ref: str) -> list[Finding]:
    text = read_file(repo, ref, NOW_MD_PATH)
    if text is None:
        return []
    n = sum(1 for line in text.splitlines() if line.startswith(NEXT_LINE_PREFIX))
    if n == 1:
        return []
    if n == 0:
        msg = f"has no line starting `{NEXT_LINE_PREFIX}` — `./plan next` prints it at a clean point (req-250)"
    else:
        msg = f"has {n} lines starting `{NEXT_LINE_PREFIX}` — keep exactly one (req-250)"
    return [Finding("next", "fail", NOW_MD_PATH, msg)]


# ------------------------------------------- check 4: SHIPPED entries stay short

# req-252 (DEC-087 §2, WORKFLOW §Requirement lanes): a SHIPPED entry is ≤3 lines — what,
# gate receipt, report path. A warning, not a failure: the size is a writing rule, and a
# long entry blocks nothing. Only entries dated AFTER the cutoff are checked — the entries
# up to and including 2026-10-30 average 6.35 lines, and a warning each on every run
# would be noise nobody reads. The date is the last YYYY-MM-DD in the `## req-N …`
# heading ("(merged 2026-10-31)" from the closeout stub, or "(2026-10-31)").
SHIPPED_PATH = "handoff/log/SHIPPED.md"
SHIPPED_MAX_BODY_LINES = 3
SHIPPED_SIZE_CUTOFF = "2026-10-30"
SHIPPED_HEADING_RE = re.compile(r"^## (req-\d+)\b")
ISO_DATE_RE = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")


def check_shipped_size(repo: str, ref: str) -> list[Finding]:
    text = read_file(repo, ref, SHIPPED_PATH)
    if text is None:
        return []
    findings: list[Finding] = []
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        m = SHIPPED_HEADING_RE.match(lines[i])
        if not m:
            i += 1
            continue
        start = i
        j = i + 1
        while j < len(lines) and not lines[j].startswith("#") and lines[j].strip() != "---":
            j += 1
        dates = ISO_DATE_RE.findall(lines[start])
        body = sum(1 for line in lines[start + 1:j] if line.strip())
        if dates and dates[-1] > SHIPPED_SIZE_CUTOFF and body > SHIPPED_MAX_BODY_LINES:
            findings.append(Finding(
                "shipped-size", "warn", f"{SHIPPED_PATH}:{start + 1}",
                f"the {m.group(1)} entry has {body} non-blank lines — keep it ≤ {SHIPPED_MAX_BODY_LINES} "
                f"(What / Gate / Report; DEC-087 §2)",
            ))
        i = j
    return findings


# ----------------------------------------------- check 5: the DEC log (req-271)

# Three failures, read from git objects at `ref` like everything above:
#   a. every DEC-NNN cited in DEC_REF_SCOPE resolves to exactly one entry heading;
#   b. (split layout) DECISIONS.md's generated index equals scripts/dec_index.py's output;
#   c. the topical digest cites no DEC whose status is `superseded` (audit 2026-10-30 §E1).
# Works on both layouts: before scripts/dec_split.py runs, the entries are still inside
# DECISIONS.md and (b) has nothing to compare. No DECISIONS.md at ref (a fixture repo) → no check.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import dec_index as di  # noqa: E402

DEC_REF_SCOPE = ["handoff", "src", "server", "scripts", "plan", "check", "README.md", ".githooks", ".claude/skills"]
RANGE_NAME_RE = re.compile(r"\bDEC-\d{3}-\d{3}\.md\b")
# File → DEC numbers allowed to dangle there: the planted fixture that tests a dangling id fires
# (check-skills.test.sh), and the req that specified this check, which names the fixture ids in
# its text. Numbers, not `DEC-NNN` text, so this file doesn't cite them itself.
DEC_REF_ALLOW = {
    "scripts/check-skills.test.sh": {999},
    "handoff/work/req-271-decisions-split-digest.md": {777, 999},
}


def _dec_log(repo: str, ref: str) -> tuple[str, list, bool] | Finding | None:
    md = read_file(repo, ref, di.DECISIONS_PATH)
    if md is None:
        return None
    names = [p for p in list_files(repo, ref, di.DECISIONS_DIR) if p.endswith(".md")]
    try:
        if names:
            files = {Path(p).name: read_file(repo, ref, p) or "" for p in names}
            return md, di.parse_range_files(files), True
        return md, di.parse_legacy(md), False
    except di.DecError as e:
        return Finding("dec-log", "fail", str(e).split(": ", 1)[0],
                       f"{str(e).split(': ', 1)[-1]} — fix it, then run: {di.REGEN_COMMAND}")


def check_dec_log(repo: str, ref: str) -> list[Finding]:
    loaded = _dec_log(repo, ref)
    if loaded is None:
        return []
    if isinstance(loaded, Finding):
        return [loaded]
    md, entries, split = loaded
    by_num = {e.num: e for e in entries}
    findings: list[Finding] = []

    out = _git(repo, ["grep", "-n", "-I", "-E", r"DEC-[0-9]{3,}", ref, "--"] + DEC_REF_SCOPE)
    prefix = f"{ref}:"
    for row in out.splitlines():
        if row.startswith(prefix):
            row = row[len(prefix):]
        path, lineno, text = (row.split(":", 2) + ["", ""])[:3]
        # A range file's name (`decisions/DEC-051-100.md`) names a file, not a decision.
        text = RANGE_NAME_RE.sub("", text)
        for m in di.DEC_ID_RE.finditer(text):
            did = m.group(0)
            if int(m.group(1)) in by_num or int(m.group(1)) in DEC_REF_ALLOW.get(path, ()):
                continue
            findings.append(Finding("dec-ref", "fail", f"{path}:{lineno}",
                                    f"cites {did}, which has no `## {did} — …` entry heading"))

    if split and di.render(md, entries) != md:
        findings.append(Finding("dec-index", "fail", di.DECISIONS_PATH,
                                f"the generated index is stale (a range file in {di.DECISIONS_DIR}/ changed) "
                                f"— run: {di.REGEN_COMMAND}  (./plan save runs it)"))

    for lineno, text in di.digest_lines(md):
        for m in di.DEC_ID_RE.finditer(text):
            e = by_num.get(int(m.group(1)))
            if e is not None and e.kind == "superseded":
                findings.append(Finding("dec-digest", "fail", f"{di.DECISIONS_PATH}:{lineno}",
                                        f"the digest cites {e.id}, which is {e.status} — point at the live DEC"))
    return findings


# ------------------------------------------- check 6: the doc-size ratchet (req-272)

# Each rule doc has a ceiling in DOC_LIMITS_PATH (one table, one place): its line count when the
# ratchet was set. Over the ceiling → fail (`plan publish` and `plan save` refuse). Raising one =
# edit the table in the same commit, with a non-empty `reason` that differs from the base's (a
# raise that keeps the old reason is a raise with no reason). ≥ TIGHTEN_FRACTION under the
# ceiling → a warning naming the new number; never edited here (no auto-correction, above).
# The table lives in scripts/ so code commits can carry it; `plan save` lets that one file
# through with handoff/ so Planner can raise a ceiling in the same save as the growth.
DOC_LIMITS_PATH = "scripts/doc_limits.json"
TIGHTEN_FRACTION = 0.10
# Never ratcheted: append-only logs (req-271), requirement docs, build reports. NOW.md has its
# own ≤NOW_MD_RULE_LIMIT rule (check 2).
DOC_LIMITS_EXCLUDED = ("handoff/log/", "handoff/work/req-", "reports/", NOW_MD_PATH)


def _parse_limits(text: str) -> dict:
    data = json.loads(text)
    docs = data.get("docs") if isinstance(data, dict) else None
    if not isinstance(docs, dict) or not docs:
        raise ValueError('no "docs" object with at least one entry')
    return docs


def doc_limit_findings(read, base_read=None) -> list[Finding]:
    """`read(path)` / `base_read(path)` return a file's text or None — git objects at a ref,
    or the working tree (`--worktree`, for `plan save` before it stages anything)."""
    raise_hint = f"raise it in {DOC_LIMITS_PATH} in the same commit, with a new non-empty \"reason\""
    text = read(DOC_LIMITS_PATH)
    if text is None:
        return [Finding("doc-limits", "fail", DOC_LIMITS_PATH,
                        "the ratchet's limits table is missing — restore it; no doc is size-checked without it")]
    try:
        docs = _parse_limits(text)
    except ValueError as e:
        return [Finding("doc-limits", "fail", DOC_LIMITS_PATH, f"unreadable limits table: {e}")]

    base_docs: dict = {}
    if base_read is not None:
        base_text = base_read(DOC_LIMITS_PATH)
        if base_text is not None:
            try:
                base_docs = _parse_limits(base_text)
            except ValueError:
                base_docs = {}

    findings: list[Finding] = []
    for path, row in sorted(docs.items()):
        where = f"{DOC_LIMITS_PATH} [{path}]"
        if any(path.startswith(x) or path == x for x in DOC_LIMITS_EXCLUDED):
            findings.append(Finding("doc-limits", "fail", where,
                                    "this path is excluded from the ratchet (log/, work/req-*, reports/, NOW.md) "
                                    "— remove the row"))
            continue
        ceiling = row.get("ceiling") if isinstance(row, dict) else None
        reason = row.get("reason") if isinstance(row, dict) else None
        if not isinstance(ceiling, int) or isinstance(ceiling, bool) or ceiling <= 0:
            findings.append(Finding("doc-limits", "fail", where, f"ceiling must be a positive integer, got {ceiling!r}"))
            continue
        if not isinstance(reason, str) or not reason.strip():
            findings.append(Finding("doc-limits", "fail", where,
                                    "empty \"reason\" — every ceiling says why it is that number"))
        base_row = base_docs.get(path)
        if isinstance(base_row, dict) and isinstance(base_row.get("ceiling"), int) \
                and ceiling > base_row["ceiling"] and isinstance(reason, str) and reason.strip() \
                and reason.strip() == str(base_row.get("reason", "")).strip():
            findings.append(Finding("doc-limits", "fail", where,
                                    f"ceiling raised {base_row['ceiling']} → {ceiling} with the old \"reason\" "
                                    f"— write why it grew"))
        content = read(path)
        if content is None:
            findings.append(Finding("doc-size", "fail", path,
                                    f"listed in {DOC_LIMITS_PATH} but not found — restore it, or remove its row"))
            continue
        count = content.count("\n")
        if count > ceiling:
            findings.append(Finding("doc-size", "fail", path,
                                    f"is {count} lines, over its ceiling of {ceiling} — trim it, or {raise_hint}"))
        elif ceiling - count >= ceiling * TIGHTEN_FRACTION:
            findings.append(Finding("doc-size", "warn", path,
                                    f"is {count} lines, ≥{int(TIGHTEN_FRACTION * 100)}% under its ceiling of "
                                    f"{ceiling} — tighten to {count} in {DOC_LIMITS_PATH}"))
    return findings


def _base_ref(repo: str, ref: str) -> str | None:
    out = _git(repo, ["rev-parse", "--verify", "--quiet", f"{ref}^"]).strip()
    return out or None


def check_doc_limits(repo: str, ref: str, base: str | None = None) -> list[Finding]:
    base = base or _base_ref(repo, ref)
    base_read = (lambda p: read_file(repo, base, p)) if base else None
    return doc_limit_findings(lambda p: read_file(repo, ref, p), base_read)


def check_doc_limits_worktree(repo: str) -> list[Finding]:
    root = Path(repo)

    def read(p: str) -> str | None:
        f = root / p
        return f.read_text() if f.is_file() else None

    has_head = bool(_git(repo, ["rev-parse", "--verify", "--quiet", "HEAD"]).strip())
    base_read = (lambda p: read_file(repo, "HEAD", p)) if has_head else None
    return doc_limit_findings(read, base_read)


# --------------------------------------------------------------------- driver

def run_checks(repo: str, ref: str, base: str | None = None) -> list[Finding]:
    findings: list[Finding] = []
    findings.extend(check_status_lines(repo, ref))
    findings.extend(check_size_claims(repo, ref))
    findings.extend(check_next_line(repo, ref))
    findings.extend(check_shipped_size(repo, ref))
    findings.extend(check_dec_log(repo, ref))
    findings.extend(check_doc_limits(repo, ref, base))
    return findings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=".", help="path to the git repository (default: .)")
    parser.add_argument("--ref", default="HEAD", help="git ref to check (default: HEAD)")
    parser.add_argument(
        "--verbose", action="store_true",
        help="also print 'unknown' and 'info' findings (permanent, non-failing shape of the "
             "data — a SHELVED requirement, tier-2's unnumbered sections) alongside fail/warn",
    )
    parser.add_argument(
        "--only", choices=["doc-limits"],
        help="run one check: doc-limits (the req-272 ratchet; `plan save` / `plan publish` refuse on it)",
    )
    parser.add_argument(
        "--base", default=None,
        help="ref whose limits table a raise is compared against (default: REF^)",
    )
    parser.add_argument(
        "--worktree", action="store_true",
        help="with --only doc-limits: read the docs and table from the working tree at --repo "
             "(compared against HEAD's table) — `plan save`, before it stages anything",
    )
    args = parser.parse_args(argv)

    if args.worktree and args.only != "doc-limits":
        parser.error("--worktree needs --only doc-limits")
    if args.only == "doc-limits":
        findings = (check_doc_limits_worktree(args.repo) if args.worktree
                    else check_doc_limits(args.repo, args.ref, args.base))
    else:
        findings = run_checks(args.repo, args.ref, args.base)
    failing = [f for f in findings if f.severity == "fail"]
    warning = [f for f in findings if f.severity == "warn"]

    # criterion 2: a clean tree prints nothing. "unknown"/"info" describe a
    # permanent, expected shape (a SHELVED requirement, tier-2's deliberately
    # unnumbered sections) rather than a problem, so they're not noise to
    # print on every single run by default — only fail/warn are.
    to_print = findings if args.verbose else failing + warning
    for f in to_print:
        print(f)

    return 1 if failing else 0


if __name__ == "__main__":
    sys.exit(main())
