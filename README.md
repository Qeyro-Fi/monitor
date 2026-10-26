# QEYRO FI monitor

A small service that watches the **QEYRO FI Threat Oracle** and tells you when something changes: the verified threat level, the oracle going stale, a new proposal, a change of attester quorum, or the monitor itself losing its RPC.

It only **reads** the chain. It holds no key, sends no transaction, and cannot change anything on-chain.

> Pre-release. The oracle contracts are unaudited and not deployed. Point it at a local or test network until that changes.

## Why you want it

Hooks on a smart account react to the oracle automatically, but the people behind the account still need to know. When the level goes up, a fail-closed hook may start restricting you within one block. When the oracle goes stale, the same hook may restrict you on old data. This service turns those on-chain facts into a message in the place you already look (a chat channel, a pager, a log shipper).

## What it reports

| Alert | When | Severity |
| --- | --- | --- |
| `level_raised` | the level went up | info at L1, warning at L2-3, **critical at L4-5** |
| `level_lowered` | the level went down | warning if still L3+, otherwise info |
| `level_refreshed` | attesters re-confirmed the same level | info |
| `became_stale` | the oracle passed its `maxAge` | warning, **critical if the level is 3+** |
| `became_fresh` | a stale oracle was refreshed | info |
| `new_proposal` | an attester opened a proposal (changes nothing yet) | info |
| `quorum_changed` | threshold or attester count changed | warning |
| `rpc_unreachable` | N polls in a row failed | **critical** |
| `rpc_recovered` | reads work again | info |
| `started` | first run, only with `ANNOUNCE_START=true` | info |

Details and example payloads: `docs/ALERTS.md`.

## Quick start

```bash
npm install
npm run build

export RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
export ORACLE_ADDRESS=0xYourDeployedThreatOracle
export EXPECTED_CHAIN_ID=11155111
export WEBHOOK_URLS=https://hooks.slack.com/services/XXX/YYY/ZZZ
export WEBHOOK_FORMAT=slack

node dist/cli.js check-config      # validates everything and reads the oracle once
node dist/cli.js send-test-alert   # sends one clearly labelled message to every webhook
node dist/cli.js run               # runs forever
```

Without `WEBHOOK_URLS` the monitor still runs and writes alerts to its log, which is a fine way to try it.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `RPC_URL` | required | JSON-RPC endpoint |
| `ORACLE_ADDRESS` | required | the ThreatOracle contract |
| `WEBHOOK_URLS` | none | comma-separated. `https` only (plain `http` allowed for localhost) |
| `WEBHOOK_FORMAT` | `generic` | `generic` (structured JSON), `slack` (`{text}`), `discord` (`{content}`, cut to 2000 chars) |
| `POLL_SECONDS` | `30` | seconds between polls, 1 to 3600 |
| `STATE_FILE` | `state.json` | remembers the last snapshot so a restart does not re-announce |
| `EXPECTED_CHAIN_ID` | none | refuse to run if the RPC serves another chain |
| `RPC_FAILURE_THRESHOLD` | `3` | failed polls in a row before `rpc_unreachable` |
| `ANNOUNCE_START` | `false` | send an alert on the very first poll |

## Behaviour you can rely on

- **Each change is announced once.** The last snapshot is saved after every poll, so restarting does not repeat old alerts.
- **At least once, not at most once.** If a webhook is down and *no* target accepted an alert, the monitor keeps the old snapshot and tries again on the next poll. If at least one target accepted it, it moves on.
- **A consistent snapshot.** All reads are pinned to one block number, so a level and its freshness can never come from two different blocks.
- **Webhook URLs are secrets.** Logs show the host only. Redirects are refused, so a webhook cannot bounce a message somewhere else.
- **No spam during an outage.** One `rpc_unreachable` alert, then silence until recovery.

## What it does not do

- It does not judge whether a level is *right*. It reports what attesters attested.
- It is not a heartbeat. If the monitor itself stops, nobody tells you; watch it with a normal uptime check (see `docs/DEPLOYMENT.md`).
- Detection latency is up to `POLL_SECONDS`. If you need faster, lower it (the RPC cost is nine calls per poll).
- Two instances do not coordinate: each keeps its own state, so you will get each alert twice. Run one per target, or accept the duplicate.

## Docs

- `docs/ALERTS.md`: every alert, its severity and a payload sample
- `docs/DEPLOYMENT.md`: systemd, Docker, and how to watch the watcher
- `docs/DESIGN.md`: why polling, why the state works the way it does

## License

MIT
