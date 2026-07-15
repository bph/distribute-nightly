# Distribute Gutenberg Nightly

Automates building and distributing the Gutenberg Nightly zip.
Learn more: https://gutenbergtimes.com/need-a-zip-from-master

Runs unattended via GitHub Actions ([nightly.yml](.github/workflows/nightly.yml)), daily at 09:00 UTC:
merges upstream trunk into [bph/gutenberg](https://github.com/bph/gutenberg), builds the plugin zip,
publishes it as a release asset, uploads via SFTP, and updates the download page.
Each run posts ✅/❌ to the build-log issue [bph/gutenberg#200](https://github.com/bph/gutenberg/issues/200).

- **Manual run:** Actions → "Distribute Gutenberg Nightly" → Run workflow (`mode=preflight` verifies credentials only; `mode=full` runs the whole routine)
- **Recovery:** on a multi-file merge conflict, run [reset-fork.yml](.github/workflows/reset-fork.yml) to reset the fork's trunk to upstream (releases/tags survive), then re-run the nightly
- **Docs:** setup details and history in [documentation/](documentation/)

Can also run locally as a CLI (`npm install -g .`, then `dist --help`) with credentials in `.env`.
