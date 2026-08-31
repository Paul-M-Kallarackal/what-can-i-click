# Security policy

## Supported versions

This is a fast-moving hackathon project. Security fixes are applied to the latest commit on `main`; older commits and forks are not maintained.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability or exposed credential.

Use GitHub's private vulnerability reporting for this repository. Include:

- the affected commit or URL;
- clear reproduction steps;
- the expected and observed behavior;
- the likely impact; and
- a suggested mitigation, if known.

Please avoid accessing data that is not yours, disrupting a deployed demo, or publishing details before a fix is available. You can expect an initial acknowledgement within seven days.

## Project security boundaries

The shipped application is static. It does not accept private ClickHouse cluster data, credentials, arbitrary SQL, executable code, custom shaders, or external asset URLs. WebMCP tool inputs are bounded by strict schemas and unknown properties are rejected.

Repository contributors must not commit API keys, access tokens, private keys, `.env` files, Wrangler credentials, or production data. Hosting secrets belong in environment-scoped secret stores and must never be exposed to Vite client code.
