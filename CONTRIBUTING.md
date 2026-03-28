# Contributing to Spendtinel

Thank you for considering a contribution to Spendtinel.

## Contributor License Agreement

By submitting a pull request, you agree that your contributions are licensed under the same [AGPL-3.0 license](LICENSE) as the project, and that the project maintainers may re-license your contributions under a commercial license (dual-licensing). This is standard practice for open-core projects and does not affect your own rights to use your contribution.

## Before You Start

- For bug fixes or small improvements, feel free to open a PR directly.
- For new features or larger changes, open an issue first to discuss the approach. This avoids wasted effort if the direction doesn't align.

## Development Setup

See the [Development Setup](README.md#development-setup) section in the README.

## Code Style

- TypeScript everywhere — no `any` unless absolutely necessary
- Tailwind CSS for styling — no inline styles
- Mobile-first: start from small screens, scale up
- 44px minimum touch targets for interactive elements
- Keep components small and focused; extract logic into hooks or lib functions

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(transactions): add bulk categorization
fix(import): handle empty description rows
chore: bump prisma to 7.5.0
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `ci`, `perf`

## Pull Request Checklist

- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] New UI strings added to both `messages/en.json` and `messages/pt.json`
- [ ] API changes reflected in `docs/application-manual.md`
- [ ] No hardcoded currency symbols (use `formatCurrency` from `src/lib/formatters.ts`)

## Reporting Bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md). Include steps to reproduce, expected behavior, and actual behavior.
