# Issue tracker: GitHub

Issues and PRDs for this repository live as GitHub issues in `fpina/PumpPal`. Use the `gh` CLI for tracker operations and infer the repository from the local `origin` remote.

## Conventions

- Create: `gh issue create --title "..." --body "..."`
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open`
- Comment: `gh issue comment <number> --body "..."`
- Label: `gh issue edit <number> --add-label "..."`
- Close: `gh issue close <number> --comment "..."`
- Link a child issue with GitHub's sub-issues endpoint when available; otherwise use a parent task list and a `Part of #<number>` reference in the child.
- Represent dependencies with native blocking relationships when available; otherwise include a `Blocked by: #<number>` line in the issue body.

## Pull requests as a triage surface

**PRs as a request surface: no.** External pull requests do not enter the issue-triage queue. Pull requests attached to planned work retain their normal review workflow.

GitHub shares one number space across issues and pull requests. Resolve an ambiguous reference with `gh pr view <number>` and fall back to `gh issue view <number>`.

## Skill routing

- When a skill says "publish to the issue tracker," create a GitHub issue.
- When a skill says "fetch the relevant ticket," run `gh issue view <number> --comments`.
- Publish dependent issues in blocker-first order so later issue bodies can reference real issue numbers.
