"""req-34: stop hand-copying what git already knows.

Three checks, one command — folded into `./plan status` and `./plan
publish` rather than a new `plan check`, since the failure mode this
fixes is "nobody ran the check", not "there's no check to run":

  1. every requirement's `Status:` line against what git can actually see
     (a merge commit, a direct commit, or an explicit hash already in the
     tag), and against `NOW.md`'s own queue where it mentions the same
     requirement.
  2. `work/BACKLOG.md`'s `## Sections` index against the real `### N.N`
     headings in `work/backlog/tier-*.md` — a duplicate number fails, a
     missing index entry warns, unnumbered headings are only listed.
  3. every size claim in `handoff/` ("N lines", or a same-file ranking
     like "second longest") against a real `wc -l` — except `NOW.md`'s
     own "keep this under 50 lines", which is a rule to enforce, not a
     fact to verify.

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
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

WORK_DIR = "handoff/work"
BACKLOG_PATH = "handoff/work/BACKLOG.md"
TIER_DIR = "handoff/work/backlog"
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
    check: str        # "status" | "status-unknown" | "sections" | "size"
    severity: str      # "fail" | "warn" | "info" | "unknown"
    subject: str       # e.g. "req-08", "§1.7", "app/static/style.css"
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
        out.append(ReqTag(slug=slug, reqid=reqid, path=path, tag_text=m.group(1) if m else ""))
    return out


def classify_tag(tag_text: str) -> tuple[str, str | None]:
    """One of 'merged' | 'not-merged' | 'blocked' | 'unknown', plus a hash
    (for 'merged') or a blocking reqid (for 'blocked') when present."""
    if re.search(r"BUILT AND (MERGED|VERIFIED)", tag_text):
        m = HASH_RE.search(tag_text)
        return ("merged", m.group(1) if m else None)
    if re.search(r"\bSHELVED\b|\bWITHDRAWN\b", tag_text):
        return ("unknown", None)
    m = BLOCKED_RE.search(tag_text)
    if m:
        return ("blocked", m.group(1))
    if re.search(r"\bREADY\b|\bNEEDS DECISIONS\b", tag_text):
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
            for reqid in REQID_RE.findall(line):
                claims.setdefault(reqid, "pending")
    return claims


def _now_claim_disagrees(category: str, now_claim: str) -> bool:
    if now_claim == "merged":
        return category != "merged"
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
        return category == "merged"
    return False


def check_status_lines(repo: str, ref: str) -> list[Finding]:
    findings: list[Finding] = []
    tags = find_requirement_tags(repo, ref)
    by_reqid = {t.reqid: t for t in tags}
    now_md_text = read_file(repo, ref, NOW_MD_PATH) or ""
    now_claims = parse_now_md_claims(now_md_text)

    for tag in tags:
        category, extra = classify_tag(tag.tag_text)

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

        elif category == "unknown":
            findings.append(Finding(
                "status", "unknown", tag.reqid,
                "cannot determine merge status from this tag (shelved/withdrawn/unparseable) — not a failure",
            ))
            continue

    return findings


# ------------------------------------------------------------- check 2: index

SECTION_HEADING_RE = re.compile(r"^### (\d+\.\d+[a-z]?)\b(.*)$", re.M)
UNNUMBERED_HEADING_RE = re.compile(r"^### (?!\d+\.\d+[a-z]?\b)(.+)$", re.M)
INDEX_ENTRY_RE = re.compile(r"\*\*§(\d+\.\d+[a-z]?)\*\*")


def check_backlog_index(repo: str, ref: str) -> list[Finding]:
    findings: list[Finding] = []
    backlog_text = read_file(repo, ref, BACKLOG_PATH)
    if backlog_text is None:
        return findings

    sections_block_match = re.search(r"## Sections\n(.*?)(\n---|\Z)", backlog_text, re.S)
    sections_block = sections_block_match.group(1) if sections_block_match else ""
    declared = set(INDEX_ENTRY_RE.findall(sections_block))

    seen: dict[str, list[str]] = {}
    unnumbered: list[tuple[str, str]] = []
    for tier_path in sorted(list_files(repo, ref, TIER_DIR)):
        if not tier_path.endswith(".md"):
            continue
        text = read_file(repo, ref, tier_path) or ""
        for m in SECTION_HEADING_RE.finditer(text):
            seen.setdefault(m.group(1), []).append(tier_path)
        for m in UNNUMBERED_HEADING_RE.finditer(text):
            unnumbered.append((tier_path, m.group(1).strip()))

    for number, paths in sorted(seen.items()):
        if len(paths) > 1:
            findings.append(Finding(
                "sections", "fail", f"§{number}",
                f"appears {len(paths)} times ({', '.join(paths)}) — a reference to it is ambiguous",
            ))
        elif number not in declared:
            findings.append(Finding(
                "sections", "warn", f"§{number}",
                f"defined in {paths[0]} but missing from BACKLOG.md's index",
            ))

    for tier_path, title in unnumbered:
        findings.append(Finding(
            "sections", "info", tier_path,
            f"unnumbered heading, cannot be referenced through the index: {title!r}",
        ))

    return findings


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


# --------------------------------------------------------------------- driver

def run_checks(repo: str, ref: str) -> list[Finding]:
    findings: list[Finding] = []
    findings.extend(check_status_lines(repo, ref))
    findings.extend(check_backlog_index(repo, ref))
    findings.extend(check_size_claims(repo, ref))
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
    args = parser.parse_args(argv)

    findings = run_checks(args.repo, args.ref)
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
