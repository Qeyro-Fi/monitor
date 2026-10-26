# Changelog

All notable changes to QEYRO FI monitor are documented here.
The format follows Keep a Changelog; versions follow Semantic Versioning.

## [Unreleased]

### Added
- Polling monitor for the ThreatOracle with ten alert kinds: level raised, lowered, refreshed; stale and fresh again; new proposal; quorum changed; RPC unreachable and recovered; started.
- Severity rules: critical at levels 4-5 and for a stale oracle at level 3+; a lowered level stays a warning while it is still 3+.
- Webhook delivery in `generic`, `slack` and `discord` formats with retries, timeouts, and no redirects; URLs never logged.
- At-least-once delivery: the saved snapshot only advances when at least one webhook accepted the alert.
- State file written atomically; an unreadable file is moved aside instead of crash-looping.
- Snapshot reads pinned to a single block number.
- Commands: `run`, `once`, `check-config`, `send-test-alert`.
- systemd unit, Dockerfile and compose file.
- 45 tests; exercised against a local node through a full propose, attest, execute, stale and RPC-outage cycle.

### Known gaps
- No built-in heartbeat for the monitor itself (see `docs/DEPLOYMENT.md`).
- Two instances do not coordinate and will both send each alert.
- Not published to npm.
