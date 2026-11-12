# Domain docs

## Read before exploring

This repository uses a single-context layout:

- `GLOSSARY.md` at the repository root: read for domain vocabulary.
- `docs/adr/`: read decisions relevant to the area being explored.

If these files do not exist, proceed silently. Do not suggest creating
them upfront. The domain-modeling skill creates them lazily as terms
or decisions are resolved.

## Use the glossary's vocabulary

Use defined domain terms in issue titles, proposals, hypotheses,
and test names. Respect explicitly avoided synonyms.

If a needed concept is absent, reconsider whether it belongs in the
domain or note the gap for domain-modeling.

## Surface ADR conflicts

Explicitly identify any proposal that contradicts an existing ADR,
with the ADR reference and reason for reopening the decision.
