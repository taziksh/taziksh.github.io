# taziksh.github.io

This repo is PUBLIC and auto-deploys to tazik.sh from main. Unpublished writing drafts are highly private.

- Never commit a file under `src/notes/` unless its frontmatter has `public: true`.
- Never use `git commit --no-verify`. The pre-commit hook in `.githooks/` guards against publishing private drafts; if it blocks a commit, the block is correct — fix the staged content, don't bypass it.
