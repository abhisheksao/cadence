# Contributing

Thanks for your interest in Cadence!

## Workflow

Every change traces back to a spec.

1. **New behavior:** open an issue first. Accepted features get a spec under `specs/NNN-name/` (via `/speckit.specify`), followed by `plan.md` and `tasks.md`.
2. **Bug fixes:** reference the spec and requirement the bug violates. If the spec was wrong, update it in the same PR.
3. Create a branch off `develop`, named after the spec (e.g. `002-morning-routine`), and open the PR against `develop`. Use [Conventional Commits](https://www.conventionalcommits.org/).

## Branches

- `main` holds released code only. Each release is a merge from `develop`, tagged `vX.Y.Z`.
- `develop` is the integration branch. Feature branches start here and merge back here.

## Before opening a PR

```bash
npx expo lint
npx tsc --noEmit
```

Both must pass. Native folders (`android/`, `ios/`) are generated, so don't commit them. Configure native behavior in `app.json` or `plugins/`.

## License

By contributing, you agree that your contributions are licensed under the [Apache License 2.0](LICENSE).
