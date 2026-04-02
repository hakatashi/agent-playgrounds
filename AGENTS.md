# AGENTS.md

This repository serves as a playground for AI coding agents to execute various one-off tasks. Each session creates a self-contained subdirectory where all work—code, dependencies, and artifacts—is performed.

## Working Guidelines

### Session Setup

- **Always create a new subdirectory** for each session or task. Name it descriptively based on the task being performed (e.g., `fitbit-heartrate-retrieval`, `csv-data-analysis`).
- **Keep all work self-contained** within the subdirectory. This includes source code, configuration files, installed dependencies (e.g., `node_modules`), and any generated output.
- Each subdirectory should be independently runnable.
- **Always create a `README.md` in English** inside the subdirectory upon completing the task. The README must cover at minimum: the purpose of the task, prerequisites, and how to run it.
- If a `package.json` or similar dependency manifest is needed, create it inside the subdirectory rather than at the repository root.

### Security and Confidentiality

**All content checked into this repository is publicly accessible.** Exercise extreme caution with every commit.

- **Never commit credentials or secrets.** This includes but is not limited to:
  - API keys and tokens (OAuth tokens, access tokens, refresh tokens)
  - Passwords and passphrases
  - `.env` files or any environment variable files containing secrets
  - Private keys, certificates, or key files
  - Session cookies or authentication headers
  - Database connection strings with embedded credentials
- **Use `.gitignore`** within each subdirectory to exclude sensitive files, build artifacts, and dependencies (e.g., `node_modules/`, `.env`, `*.key`).
- **Never commit large generated or build artifacts.** This includes but is not limited to:
  - Generated data files (JSON, CSV, etc.) produced by scripts
  - Compiled binaries and build output
  - Downloaded datasets or external resources
  - Any file that can be reproduced by running a script in the repository
  - As a rule of thumb, do not commit any single file exceeding 100 KB
  - Always add such files to `.gitignore` and ensure the script can regenerate them on demand.
  - **Exception:** `gradle/wrapper/gradle-wrapper.jar` in Android/Gradle projects may be committed. It is a small (~43 KB) bootstrap binary required to run `./gradlew` without a pre-installed Gradle, and committing it is the official Gradle recommendation.
- If a task requires credentials at runtime, read them from environment variables or prompt the user for input—never hardcode them.

### Python Environment

- **Always use a virtual environment (`venv`)** when Python library installation is required. Create it inside the task subdirectory (e.g., `python3 -m venv venv`).
- **Never modify the global Python environment.** Avoid `pip install` without an active venv, and do not use `sudo pip install` or `pip install --user` to install packages globally.
- Invoke Python and pip through the venv (e.g., `venv/bin/python3`, `venv/bin/pip`) rather than activating the venv with `source venv/bin/activate`, to keep shell state changes minimal.
- Add `venv/` to the subdirectory's `.gitignore` so the virtual environment is never committed.

### Copyright and Licensing

- **Do not commit copyrighted material** that you do not have the right to redistribute. This includes proprietary datasets, copyrighted text, images, or any third-party content not explicitly licensed for redistribution.
- When using third-party libraries, ensure they are installed via a package manager (e.g., npm, pip) and listed in the appropriate manifest file rather than vendored directly, unless the license permits it.

### Pre-Commit Review

Before every commit, perform the following checks:

1. Update the subdirectory's `README.md` to reflect any changes made in this commit (new scripts, changed usage, updated output format, etc.).
2. Review all staged changes line by line (e.g., `git diff --staged`).
3. Verify that no credentials, secrets, or sensitive information are present in the diff.
4. Verify that no large generated files or build artifacts are included in the diff.
5. Verify that no copyrighted or legally problematic files are included.
6. Confirm that all changes are within the intended subdirectory and do not modify unrelated files.
7. After pushing, briefly review the commit on the remote to ensure nothing was accidentally included.
