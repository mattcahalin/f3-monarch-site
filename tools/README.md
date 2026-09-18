# Refreshing the Beatdown Generator data

The generator (`beatdown-generator.html`) reads `data/backblasts.md`. To rebuild it from a new beatdowns export:

1. Convert the CSV's `backblast` column to Warmup / Thang / Mary sections. Keep this full file off the site.

   ```
   python tools/csv_to_backblasts_md.py "beatdowns.csv" "backblasts-full.md"
   ```

2. Scrub it down to workout information only (drops personal chatter, COT, and PAX names/mentions), and write a report of every dropped line:

   ```
   python tools/scrub_backblasts.py "backblasts-full.md" "beatdowns.csv" data/backblasts.md "scrub-report.md"
   ```

3. Skim the report, then commit `data/backblasts.md`. Don't commit the full file, the CSV, or the report; they contain the unscrubbed text.

Whenever `data/backblasts.md` or `js/beatdown-generator.js` changes, update its `?v=` tag in `beatdown-generator.html` so phones don't keep a stale copy (GitHub Pages lets browsers cache files for 10 minutes):

```
sed -i "s#beatdown-generator.js?v=[0-9a-f]*#beatdown-generator.js?v=$(md5sum js/beatdown-generator.js | cut -c1-8)#; s#backblasts.md?v=[0-9a-f]*#backblasts.md?v=$(md5sum data/backblasts.md | cut -c1-8)#" beatdown-generator.html
```
