# Issue tracker: GitHub

Issues and specs live in GitHub Issues for
`ATLTVHEAD/atltvhead.github.io`. Use the `gh` CLI.

## Conventions

- Confirm the target with `gh repo view --json nameWithOwner`
  before the first issue creation of a session.
- Create: `gh issue create --title "..." --body "..."`
- Read: `gh issue view <number> --json number,title,body,labels,comments`
- List: `gh issue list --state open --json number,title,body,labels`
- Comment: `gh issue comment <number> --body "..."`
- Label: `gh issue edit <number> --add-label "..."` or
  `--remove-label "..."`
- Close: post an explanatory comment, then `gh issue close <number>`.
  Comment separately even if the issue is already closed.

Use native GitHub sub-issues for parent-child relationships and native
issue dependencies for blockers when supported by the installed CLI/API.
Otherwise, put `Part of #<parent>` and `Blocked by: #<number>` at the
top of the child body. A ticket is unblocked when every blocker is closed.

File issues only in the user's intended repository. Check explicitly
when working in forks, where gh may default to an upstream repository.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Skill terminology

- "Publish to the issue tracker": create a GitHub issue.
- "Fetch the relevant ticket": read the GitHub issue.
