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
