# Contributing

Use Node.js 22 or later and run `npm test`. No dependency installation is required.

For a rule change, include:

1. The catalog problem and an independently created sample showing it.
2. A test for both the intended finding and a plausible false positive.
3. Updated rule documentation and a note if the score changes.

Keep rules deterministic and reports explainable. Preserve input immutability, explicit pagination checks, and the CLI's refusal to overwrite files. Do not submit private merchant exports, employer source code, API credentials, or product data you cannot share publicly.

Bugs can be reported with a minimal synthetic input, expected result, actual result, and Node version.
