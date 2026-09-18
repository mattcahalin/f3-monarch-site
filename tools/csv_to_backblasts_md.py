import csv, io, re, sys, collections

SRC = sys.argv[1]
DST = sys.argv[2]
csv.field_size_limit(10**9)

SECTIONS = {
    'warmup': r'warm[\s\-]*ups?|warm[\s\-]*o[\s\-]*rama|warm',
    'thang':  r'(?:(?:the|tha|group)\s+)?thang',
    'mary':   r'(?:the\s+)?mary|recover\s*/\s*mary',
}
STOP = r'''q|co-?q|pax|count|date|fngs?|ao|cot|circle of trust|announcements?|annoucements|conditions?|event type|
disclaimers?(?:\s+given)?|disclaimer\s*/\s*cpr(?:\s+check)?|intro(?:\s*/\s*disclaimer|\s+and\s+disclaimer)?|where|when|time|
mission(?:\s+statement|\s*&\s*diccs|\s+and\s+cps)?|five\s+core\s+princip[ae]ls|core\s+princip[ae]ls|princip[ae]ls(?:\s*/\s*mission\s*/\s*credo)?|
cre+do|creed|motto|diccs|cor|nor|cor\s*/\s*nor|cor and nor|weather|mileage|heart|what|why|
cpr|crp|recover(?:\s+recover)?|(?:count|name)[\s\-]*[ao][\s\-]*rama|fng naming|love you men|kotters|
foopc|qsource(?:\s+this\s+week)?|vq|him of the week|tunes|music|location|check slack|thanks everybody|thanks everyone|
prayer requests?|prayers?|naked moleskin|moleskin|ball of man|bom|words of wisdom|syitg|warning given'''
STOP = re.sub(r'\s*\n\s*', '', STOP)

LEAD = r'^[\s>*_~#\-•]*(?::[a-z0-9_+\-]+:\s*)*[\s*_~]*'
NUM = r'(?:\s*(?:#|no\.?|part)?\s*(?:\d+|[ivx]+\b))?(?:\s*\([^)]*\))?'
BARE = r'[\s*_~:;!.\-]*$'
TAIL = r'[\s*_~]*(?::|;|!|[\-\u2013\u2014](?=\s))[\s*_~]*'
sec_re = {k: re.compile(LEAD + r'(?:' + v + r')' + NUM + r'(?:' + TAIL + r'(.*)|' + BARE + r')$', re.I) for k, v in SECTIONS.items()}
stop_re = re.compile(LEAD + r'(?:(?:' + STOP + r')(?:' + TAIL + r'|' + BARE + r')|recover(?:[\s,!.]+recover)?[\s!.]*$|(?:nor|cor|cot)(?:\s*/\s*(?:nor|cor|cot|announcements?))+\b)', re.I)
bb_re = re.compile(LEAD + r'back\s*blast' + r'[\s*_~]*[:!\-]*[\s*_~]*(.*)$', re.I)


def clean(s):
    s = re.sub(r'<@U\w+\|([^>]+)>', r'@\1', s)
    s = re.sub(r'<@U\w+>', '@PAX', s)
    s = re.sub(r'<#C\w+\|([^>]+)>', r'#\1', s)
    s = re.sub(r'<#C\w+>', '#AO', s)
    s = re.sub(r'<!(?:here|channel|everyone)[^>]*>', '', s)
    s = re.sub(r'<(https?://[^|>]+)\|([^>]+)>', r'[\2](\1)', s)
    s = re.sub(r'<(https?://[^>]+)>', r'<\1>', s)
    return s.rstrip()


def strip_fmt(s):
    return re.sub(r'^[\s*_~]+|[\s*_~]+$', '', s)


def parse(text):
    out = {'backblast': None, 'warmup': [], 'thang': [], 'mary': []}
    cur = None
    for line in text.splitlines():
        if out['backblast'] is None:
            m = bb_re.match(line)
            if m:
                out['backblast'] = strip_fmt(clean(m.group(1)))
                cur = None
                continue
        hit = None
        for k, rx in sec_re.items():
            m = rx.match(line)
            if m:
                hit = (k, m.group(1) or '')
                break
        if hit:
            cur = hit[0]
            if out[cur]:
                out[cur].append('')
            if hit[1].strip():
                out[cur].append(hit[1])
            continue
        if stop_re.match(line) or bb_re.match(line):
            cur = None
            continue
        if cur:
            out[cur].append(line)
    for k in ('warmup', 'thang', 'mary'):
        out[k] = [clean(l) for l in out[k]]
        while out[k] and not out[k][0].strip(): out[k].pop(0)
        while out[k] and not out[k][-1].strip(): out[k].pop()
    return out


BULLET = re.compile(r'^\s*(?:[•●▪◦‣\-–*]|\d+[.)])\s+')


def to_md(lines):
    blocks, para, lst = [], [], []
    def flush():
        if para: blocks.append('  \n'.join(para)); para.clear()
        if lst: blocks.append('\n'.join(lst)); lst.clear()
    for l in lines:
        if not l.strip():
            flush(); continue
        if BULLET.match(l):
            if para: flush()
            num = re.match(r'^\s*(\d+)[.)]\s+', l)
            lst.append((num.group(1) + '. ' if num else '- ') + BULLET.sub('', l, 1).strip())
        else:
            if lst: flush()
            para.append(l.strip())
    flush()
    return '\n\n'.join(blocks)


# Left out of the generator: whole AOs by Slack channel id, and any ruck in the parts the site shows.
EXCLUDE_AOS = {
    'C03185U8VS6',   # Zombie Ridge (ruck AO)
}
# "ruck" not preceded by another letter (so "_ruck_" counts, "truck" and "Thunderstruck" don't), plus GoRuck/GrowRuck.
RUCK = re.compile(r'(?:\bgo|\bgrow)[\s-]*ruck|(?<![a-z])ruck', re.I)

rows = list(csv.reader(io.open(SRC, encoding='utf-8-sig', newline='')))
hdr = rows[0]
bi, di, ai = hdr.index('backblast'), hdr.index('bd_date'), hdr.index('ao_id')
seen, recs = set(), []
stats = collections.Counter()
for r in rows[1:]:
    if len(r) <= bi or not r[bi].strip():
        stats['empty'] += 1; continue
    if r[bi] in seen:
        stats['duplicate'] += 1; continue
    seen.add(r[bi])
    if r[ai] in EXCLUDE_AOS:
        stats['excluded_ao'] += 1; continue
    p = parse(r[bi])
    if not ''.join(p['thang']).strip():
        stats['no_thang'] += 1; continue
    if RUCK.search(' '.join([p['backblast'] or ''] + p['warmup'] + p['thang'] + p['mary'])):
        stats['ruck'] += 1; continue
    recs.append((r[di], p))
recs.sort(key=lambda x: x[0], reverse=True)

parts = ['# F3 Backblasts\n']
for _, p in recs:
    parts.append('## ' + (p['backblast'] or 'Backblast') + '\n')
    for k, label in (('warmup', 'Warmup'), ('thang', 'Thang'), ('mary', 'Mary')):
        if ''.join(p[k]).strip():
            parts.append('### ' + label + '\n\n' + to_md(p[k]) + '\n')
    parts.append('---\n')
io.open(DST, 'w', encoding='utf-8', newline='\n').write('\n'.join(parts))
stats['written'] = len(recs)
stats['with_warmup'] = sum(1 for _, p in recs if ''.join(p['warmup']).strip())
stats['with_mary'] = sum(1 for _, p in recs if ''.join(p['mary']).strip())
stats['no_title'] = sum(1 for _, p in recs if not p['backblast'])
print(dict(stats))
