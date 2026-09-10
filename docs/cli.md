# CLI reference

```sh
node src/cli.mjs catalog.json [options]
```

| Option | Default | Behavior |
| --- | --- | --- |
| --format markdown\|json | markdown | Human-readable findings or complete structured report |
| --output path | stdout | Creates a new file; refuses to overwrite the input or an existing output |
| --fail-on error\|warning\|never | never | error fails on errors; warning fails on errors or warnings |
| --min-score 0..100 | unset | Fails if the rounded catalog score is below the threshold |
| --min-description-words n | 40 | Integer from 1 through 10000 |
| --help | | Prints usage |

Exit 0 means the audit ran and all requested gates passed, or no gate was requested. It does not necessarily mean there are no findings. Exit 1 means a quality gate failed; the report is still emitted. Exit 2 means input, configuration, or file I/O was invalid.

```sh
node src/cli.mjs examples/catalog.json --format json --output report.json
node src/cli.mjs examples/catalog.json --fail-on error
```

For private catalogs, keep output reports private too: they contain product titles, identifiers, and paths from the input. The tool makes no outbound requests and never changes the catalog. `reports/` is ignored by Git; create that directory yourself if you want to use it for output.
