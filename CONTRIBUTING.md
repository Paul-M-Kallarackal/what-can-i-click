# Contributing

Thanks for helping make ClickHouse internals easier to understand.

## Development workflow

1. Create a focused branch from `main`.
2. Install dependencies with `bun install --frozen-lockfile`.
3. Make the smallest coherent change.
4. Run `bun run check` and `bun run test:e2e`.
5. Open a pull request explaining the user-visible behavior and verification performed.

## Evidence changes

- Prefer official ClickHouse documentation for product behavior.
- Mark claims as `official`, `derived`, or `field`.
- Scope version-sensitive claims explicitly.
- Do not infer a company version when its source does not disclose one.
- Keep quotations short and link directly to the supporting page.

## Advisor changes

Recommendation rules must remain deterministic, bounded, and testable. Add tests for a positive recommendation, its important alternative, and at least one malformed input. Do not accept credentials, arbitrary SQL, executable content, private cluster data, or external asset URLs.

## Visualization changes

Visual motion must explain a real mechanism. Every animated state requires a reduced-motion equivalent and a synchronized text description. Avoid exact timing claims unless the evidence registry supports them.

## Security

Never commit secrets. Before submitting a pull request, inspect the staged diff and run `bun run audit`. Report vulnerabilities privately according to [`SECURITY.md`](SECURITY.md).
