"""Build {backblast raw text -> 'Q1, Q2'} from the beatdowns CSV."""
import csv, re, collections, json, sys
csv.field_size_limit(10**9)

def label_line(text, label):
    for line in text.splitlines():
        if label == 'q' and re.match(r'^[\s*_>]*co-?q', line, re.I):
            continue
        m = re.match(r'^[\s*_>]*' + label + r'[\s*_]*:(.*)$', line, re.I)
        if m:
            return m.group(1).strip()
    return None

def tidy(n):
    n = n.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    n = re.sub(r'(?<!\w):[a-z0-9_+\-]+:(?!\w)', '', n)          # Slack emoji codes
    n = re.sub(r'\(([^)]*)\)', lambda m: '' if len(m.group(1).split()) >= 4 else m.group(0), n)   # asides
    n = n.replace('@', '')
    return re.sub(r'\s+', ' ', n).strip(' .')


def split_names(s):
    return [tidy(n) for n in s.split(',') if tidy(n)]

def build(path):
    rows = list(csv.DictReader(open(path, encoding='utf-8-sig', newline='')))
    idname = collections.defaultdict(collections.Counter)
    for r in rows:
        for lab in ('q', 'pax'):
            parsed, raw = label_line(r['backblast_parsed'], lab), label_line(r['backblast'], lab) or ''
            ids = re.findall(r'<@(U\w+)', raw)
            if parsed and ids:
                names = split_names(parsed)
                if len(names) == len(ids):
                    for i, n in zip(ids, names):
                        idname[i][n] += 1
        for i, n in re.findall(r'<@(U\w+)\|([^>]+)>', r['backblast']):
            idname[i][n.strip()] += 1
    best = {i: c.most_common(1)[0][0] for i, c in idname.items()}
    out, stats = {}, collections.Counter()
    for r in rows:
        bb = r['backblast']
        if not bb.strip():
            continue
        parsed = label_line(r['backblast_parsed'], 'q')
        names = split_names(parsed) if parsed else []
        if not names:
            names = [best[i] for i in (r['q_user_id'].strip(), r['coq_user_id'].strip()) if i and i in best]
        names = list(dict.fromkeys(n for n in names if n and not re.match(r'^(?:none|n/?a|tbd)$', n, re.I)))
        stats['with_q' if names else 'no_q'] += 1
        out[bb] = ', '.join(names)
    return out, stats, len(best)

if __name__ == '__main__':
    out, stats, n = build(sys.argv[1])
    print(dict(stats), 'ids', n)
