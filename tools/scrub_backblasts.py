"""Scrub backblasts.md down to workout information only.

Usage:
  python tools/scrub_backblasts.py FULL_BACKBLASTS_MD BEATDOWNS_CSV data/backblasts.md REPORT_MD

Keeps lines that describe the workout (exercises, reps, formats, setup, travel) and drops
personal chatter, shout-outs, faith/COT/announcement content, and anything that names a PAX.
PAX nicknames are read from the PAX:/Q: lines of the CSV at run time, never stored here.
The report lists every dropped line so the rules can be checked.
"""
import collections
import csv
import io
import random
import re
import sys

SRC, CSV_PATH, DST, REPORT = sys.argv[1:5]
csv.field_size_limit(10**9)

# ---------- PAX nicknames from the CSV ----------
NOT_NAMES = re.compile(r"^(?:none|no(?:pe|ne today|t today|t this time|body)?|nada|zero|negative|negatory|n/?a|yes|fngs?|welcome|amp|"
                       r"kinda|super|cry|no cry|nuh huh|see above|tbd|na)$", re.I)


def harvest_names(path):
    label = re.compile(r"^[\s*_>]*(?:pax|q|co-?q|fngs?|vq|site q|qic)[\s*_]*:(.*)$", re.I)
    names = collections.Counter()
    with io.open(path, encoding="utf-8-sig", newline="") as fh:
        rows = csv.reader(fh)
        header = next(rows)
        bi = header.index("backblast")
        for r in rows:
            if len(r) <= bi:
                continue
            for line in r[bi].splitlines():
                m = label.match(line)
                if not m:
                    continue
                text = re.sub(r"<[^>]+>", " ", m.group(1))
                for tok in re.split(r",|\band\b|&|/|;|\+|\(|\)|\s{2,}", text):
                    tok = re.sub(r"[^A-Za-z'\.\- ]", "", tok).strip(" .-'")
                    if 3 <= len(tok) <= 30 and len(tok.split()) <= 3 and not NOT_NAMES.match(tok):
                        names[tok] += 1
    return names


# ---------- Rules ----------
PERSONAL_WORDS = r"""
  pray\w*|praise\w*|god|god's|jesus|lord|christ|church|bible|scripture|verse|devotion\w*|faith|bless\w*|amen|
  wife|wives|husband|m's|kids?|2\.0s?|sons?|daughters?|family|families|mom|dad|mother|father|brother|sister|grandpa|grandma|grandparents?|parents?|newborn|gifts?|pregnan\w*|
  birthday|bday|anniversar\w*|wedding|funeral|memorial service|passed away|died|death|cancer|surgery|hospital\w*|sick|illness|diagnos\w*|
  injur\w*|rehab|therapy|mental health|depress\w*|anxiety|addict\w*|sober\w*|
  jobs?|laid off|fired|career|boss|coworkers?|vacation|divorce\w*|marri\w*|
  thank\w*|thx|ty|shout[\s-]?outs?|congrat\w*|welcome\w*|kudos|props|great job|nice job|good job|well done|way to go|appreciat\w*|proud|
  love you|miss(?:ed)? you|fngs?|named|naming|name-?o-?rama|cot\d*|circle of trust|
  discuss\w*|conversations?|talked|stor(?:y|ies)|jokes?|facebook|instagram|social media|announcements?|preblast|back\s?blasts?|coffeeteria|coffee|beer\w*|breakfast|donuts?|
  fellowship|mumble\s?chatter|fartsack\w*|downrange|visitors?|visiting|hc|hard commit|q ?source|slack|sign[\s-]?ups?|register\w*|
  blood drive|donat\w*|charity|fundrais\w*|t-?shirts?|shirts?|swag|convergence|lol|haha\w*|lmao|rofl|smh|
  honor(?:ing|ed)?|in memory|rip|veteran'?s?|served|deployment|
  photo\w*|pics?|picture\w*|video\w*|playlist|spotify|dj
"""
# One alternation per line above; a space inside a phrase means "any whitespace".
PERSONAL = re.compile(r"\b(?:" + re.sub(r"\s*\n\s*", "", PERSONAL_WORDS).replace(" ", r"\s+") + r")\b", re.I)
FIRST_PERSON = re.compile(r"\b(?:i|i'm|im|i've|i'd|i'll|me|my|mine|myself)\b|\bi(?=’)", re.I)
THIRD_PERSON = re.compile(r"\b(?:he|he's|him|his|she|her|y'all|you guys)\b|\bhe(?=’)", re.I)
NUMBER = re.compile(r"\d|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|fifty|hundred)\b", re.I)
WORD = re.compile(r"[a-z][a-z'\-]+")
STOPWORDS = set("""a an the and or of to in on at for with from by as is are was were be been it its this that then than
we us our you your they them their there here up down out over under into onto off all each every some any more most
not no so but if when while after before until again also just only very too can could would should will did do does done
got get had has have going went go come came back first next last other another same new time times minute minutes min mins""".split())


def unquoted(text):
    """Drop quoted lyrics and roman-numeral labels before looking for pronouns."""
    text = re.sub(r'["“][^"”]*["”]', " ", text)
    return re.sub(r"\b(?:part|round|phase|level|station|set)\s+I+\b|\w-I-\w", " ", text, flags=re.I)


def mention_free(line):
    """Remove @mentions and the little phrases that carry them."""
    line = re.sub(r"\([^)]*@\w[^)]*\)", "", line)
    line = re.sub(r"\b(?:led|called|brought|suggested|requested|courtesy|compliments|inspired|shown|taught|named|created|invented)\s+(?:by|of)\s+@\w+(?:'s)?", "", line, flags=re.I)
    line = re.sub(r"\b(?:thanks to|per|from|with|like|for)\s+@\w+(?:'s)?", "", line, flags=re.I)
    line = re.sub(r"@\w+(?:'s)?", "PAX", line)
    return re.sub(r"\s{2,}", " ", line).strip()


def build_vocab(entries, names_lc):
    """Words used in short workout lines across many backblasts: the working vocabulary."""
    seen = collections.defaultdict(set)
    for i, e in enumerate(entries):
        for sec in ("warmup", "thang", "mary"):
            for line in e[sec]:
                t = re.sub(r"^\s*(?:[-*]|\d+\.)\s+", "", line).lower()
                if "@" in t or len(t.split()) > 6:
                    continue
                for w in WORD.findall(t):
                    seen[w].add(i)
    return {w for w, s in seen.items() if len(s) >= 8 and w not in STOPWORDS and w not in {"http", "https", "www", "com"} and w not in names_lc and not PERSONAL.fullmatch(w)}


def workout_score(line, vocab):
    words = WORD.findall(line.lower())
    score = sum(1 for w in words if w in vocab or w.rstrip("s") in vocab or w + "s" in vocab or w.replace("men", "man") in vocab)
    if NUMBER.search(line):
        score += 1
    return score


def scrub_line(raw, vocab, name_re, dropped, sec):
    line = raw
    if not line.strip():
        return ""
    bullet = re.match(r"^\s*(?:[-*]|\d+\.)\s+", line)
    prefix = bullet.group(0) if bullet else ""
    body = line[len(prefix):]
    reason = None

    body = re.sub(r"\[([^\]]*)\]\([^)]*\)|<https?://[^>]+>|https?://\S+", "", body)   # links
    body = re.sub(r"(?<!\w):[a-z0-9_+\-]+:(?!\w)", "", body)                          # emoji codes
    body = re.sub(r"\bYH[CQ]'?s?\b", "Q", body)
    had_mention = "@" in body
    had_name = bool(name_re and name_re.search(body))

    plain = re.sub(r"[_*~]", " ", body)   # Slack italics/bold hide word boundaries
    if PERSONAL.search(plain):
        reason = "personal / COT / chatter"
    else:
        if had_mention:
            body = mention_free(body)
        if had_name:
            body = name_re.sub("PAX", body)
        score = workout_score(body, vocab)
        words = len(WORD.findall(body.lower()))
        if not re.search(r"[A-Za-z]", body) and len(re.findall(r"\d+", body)) >= 2:
            pass  # a bare rep scheme like 20-15-10-5
        elif not re.search(r"[A-Za-z]", body) or re.fullmatch(r"(?:PAX[\s,&and]*)+[.!:]*", body.strip()):
            reason = "empty after removing names"
        elif (had_mention or had_name) and (score < 1 or (words > 8 and score < 2)):
            reason = "names a PAX"
        elif FIRST_PERSON.search(unquoted(plain)):
            reason = "first-person narrative"
        elif THIRD_PERSON.search(unquoted(plain)) and (had_mention or had_name or score < 3 or score * 3 < words):
            reason = "about a specific PAX"
        elif re.search(r"\bPAX\s+(?:said|noted|asked|mentioned|exclaimed|yelled|shouted|commented|joked|claimed|admitted)\b", body, re.I):
            reason = "about a specific PAX"
        elif re.search(r"PAX,\s*PAX", body):
            reason = "names a PAX"
        elif score == 0:
            reason = "not workout info"
        elif words > 25 and score * 6 < words:
            reason = "mostly narrative"
    if reason:
        dropped[reason].append((sec, raw.strip()))
        return None
    return prefix + body.strip()


def parse(md):
    entries = []
    for chunk in md.split("\n## ")[1:]:
        nl = chunk.index("\n")
        e = {"title": chunk[:nl].strip(), "warmup": [], "thang": [], "mary": []}
        for sec in chunk[nl:].split("\n### ")[1:]:
            k = sec[:sec.index("\n")].strip().lower()
            body = re.sub(r"\n---\s*$", "", sec[sec.index("\n"):]).strip("\n")
            if k in e:
                e[k] = body.split("\n")
        entries.append(e)
    return entries


def tidy(lines):
    out = []
    for l in lines:
        if l == "" and (not out or out[-1] == ""):
            continue
        out.append(l)
    while out and out[-1] == "":
        out.pop()
    return out


def main():
    md = io.open(SRC, encoding="utf-8").read()
    entries = parse(md)
    counts = harvest_names(CSV_PATH)
    lower_text = collections.Counter(w for e in entries for s in ("warmup", "thang", "mary") for l in e[s] for w in WORD.findall(l))
    names = sorted({n for n in counts if not any(lower_text[w] >= 3 for w in [n.lower()] + n.lower().split())}, key=len, reverse=True)
    name_re = re.compile(r"(?<![\w@])(?:" + "|".join(re.escape(n) for n in names) + r")(?:'s)?(?!\w)") if names else None
    vocab = build_vocab(entries, {n.lower() for n in names})

    dropped = collections.defaultdict(list)
    out_entries, stats = [], collections.Counter()
    for e in entries:
        new = {}
        for sec in ("warmup", "thang", "mary"):
            kept = []
            for l in e[sec]:
                s = scrub_line(l, vocab, name_re, dropped, sec)
                if s is not None:
                    kept.append(s)
            new[sec] = tidy(kept)
        title = re.sub(r"(?<!\w):[a-z0-9_+\-]+:(?!\w)", "", e["title"]).strip()
        if "@PAX" in title or (name_re and name_re.search(title)) or FIRST_PERSON.search(unquoted(title)) or \
                THIRD_PERSON.search(unquoted(title)) or re.search(
                r"\b(?:birthday|bday|wedding|funeral|in memory|rip|farewell|retire\w*|welcome|congrat\w*|goodbye|send[\s-]?off)\b", title, re.I):
            dropped["title"].append(("title", title))
            title = "Backblast"
        new["title"] = title or "Backblast"
        if not any(workout_score(l, vocab) for l in new["thang"]):
            stats["dropped_no_thang_left"] += 1
            continue
        out_entries.append(new)

    parts = ["# F3 Backblasts (workout only)\n"]
    for e in out_entries:
        parts.append("## " + e["title"] + "\n")
        for sec, label in (("warmup", "Warmup"), ("thang", "Thang"), ("mary", "Mary")):
            if any(l.strip() for l in e[sec]):
                parts.append("### " + label + "\n\n" + "\n".join(e[sec]) + "\n")
        parts.append("---\n")
    io.open(DST, "w", encoding="utf-8", newline="\n").write("\n".join(parts))

    total_lines = sum(len([l for l in e[s] if l.strip()]) for e in entries for s in ("warmup", "thang", "mary"))
    rep = ["# Scrub report\n",
           f"- Backblasts in: {len(entries)}  \n- Backblasts out: {len(out_entries)} ({stats['dropped_no_thang_left']} dropped: nothing workout-related left in the Thang)",
           f"- Lines in: {total_lines}  \n- Lines dropped: {sum(len(v) for v in dropped.values())}",
           f"- PAX nicknames checked: {len(names)}\n"]
    rng = random.Random(1)
    for reason, items in sorted(dropped.items(), key=lambda kv: -len(kv[1])):
        rep.append(f"## {reason} ({len(items)})\n")
        for sec, text in rng.sample(items, min(60, len(items))):
            rep.append(f"- [{sec}] {text[:220]}")
        rep.append("")
    io.open(REPORT, "w", encoding="utf-8", newline="\n").write("\n".join(rep))
    print({"in": len(entries), "out": len(out_entries), **{k: len(v) for k, v in dropped.items()}, "names": len(names), "vocab": len(vocab)})


main()
