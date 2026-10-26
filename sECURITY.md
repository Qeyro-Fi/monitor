# Security policy

QEYRO FI monitor is pre-release software and has not been independently audited.

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

1. Open a private advisory: https://github.com/qeyro-fi/qeyro-fi-monitor/security/advisories/new
2. Describe what you found, how to reproduce it, and what you think the impact is.

You will get an acknowledgement within 7 days. We ask for a 90-day disclosure window by default.

## In scope

The monitor only reads the chain and posts to URLs you configure, so the interesting risks are about **what it sends and where**:

- A way to make it send to a different host than configured (redirects, URL parsing tricks, DNS rebinding to internal addresses)
- A webhook URL (they carry tokens) appearing in logs, errors, the state file or alert bodies
- Plain `http` accepted for a non-local webhook
- Injection through on-chain data (`sourceURI`, evidence) into a chat message or a log line
- A way to make the monitor stay silent about a level change, or stop sending after a crafted oracle response
- A state file that can be abused to suppress alerts
- Unsafe defaults in the Docker or systemd files

## Out of scope

- Compromise of the machine that runs the monitor
- An RPC provider that lies (a stated limit: cross-check critical decisions with a second endpoint)
- Contract-level issues (report those in `qeyro-fi-contracts`)

## What we promise (and do not)

- We will credit reporters who want credit.
- There is no bug bounty yet.
- The monitor reports what the oracle says. It guarantees neither that the oracle is right nor that you will be alerted in time.
