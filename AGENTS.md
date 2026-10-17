<!-- This section is maintained by the coding agent via lore (https://github.com/BYK/loreai) -->
## Long-term Knowledge

For long-term knowledge entries managed by [lore](https://github.com/BYK/loreai) (gotchas, patterns, decisions, architecture), see [`.lore.md`](.lore.md) in the project root.
<!-- End lore-managed section -->

## Pull requests and Craft releases

- Use a Conventional Commit PR title: `type(scope): description`; the scope is optional.
- Choose the type by the change: `feat` for features, `fix` for bugs, `docs` for documentation, and `ci`, `build`, `test`, `ref`, `perf`, or `chore` for internal work.
- Describe the resulting behavior in the title, for example `fix(schema): preserve descriptions on recursive references`; Craft uses it as a changelog entry.
- Mark breaking changes with `!`, for example `feat(api)!: remove the legacy resolver`, and explain the migration in the PR body.
- Keep the squash-merge title consistent with the reviewed PR title; use Conventional Commit messages for commits that will land without squashing.
- Use `#skip-changelog` in the PR body or the `skip-changelog` label only when deliberately excluding the change from release notes, never to hide a failed check.
- Follow [.craft.yml](.craft.yml): changelogs are automatic and release versions are manual; do not hand-edit `CHANGELOG.md` or bump package versions unless the task explicitly calls for it.
- Before requesting merge, inspect the test, release-preview, and changelog-preview checks and read any failed job's logs.
- When Craft is available, inspect `craft changelog --pr <number> --format json`; otherwise inspect the changelog-preview check and comment.
- Leave release preparation and publishing to [.github/workflows/release.yml](.github/workflows/release.yml) and [.github/workflows/publish.yml](.github/workflows/publish.yml); do not trigger releases or add the `accepted` publish label without explicit authorization.

## Fork PR preview failures

- [.github/workflows/changelog-preview.yml](.github/workflows/changelog-preview.yml) calls Craft under `pull_request_target`; fork PRs can fail before title or changelog processing at checkout.
- If logs say `Refusing to check out fork pull request code`, report the workflow limitation separately; changing the title, labels, or body cannot fix that failure.
- Never enable `allow-unsafe-pr-checkout` or grant fork code access to base-repository secrets to make the preview pass.
