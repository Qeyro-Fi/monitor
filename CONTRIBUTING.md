# Contributing to QEYRO FI monitor

The monitor exists to make sure people hear about on-chain changes. A change that quietly makes it miss one is worse than a bug that crashes it.

## Before you start

- Open an issue for a new alert, format or deployment option. Say which on-chain fact it reports and who should be woken up by it.
- Found a security problem? Do not open an issue. Follow `SECURITY.md`.

## Set up

```bash
git clone https://github.com/qeyro-fi/qeyro-fi-monitor && cd qeyro-fi-monitor
npm install
npm test                # 45 tests
npm run build && node dist/cli.js --help
```

## Adding an alert

1. Add the new `kind` to `AlertKind` in `src/types.ts`.
2. Add one branch to `detect()` in `src/detect.ts`. Keep it pure: no I/O, no clock.
3. Decide the severity and write down why in a comment. Critical means "look now".
4. Add tests next to the others in `test/detect.test.ts`, including the case where nothing should fire.
5. Document it in `docs/ALERTS.md` with what to do when it fires.

## Rules

- Delivery stays at-least-once. If you touch `monitor.ts`, keep (and test) the rule that the snapshot only advances when somebody received the alert.
- Webhook URLs never appear in logs or errors. Use `hostOf()`.
- No new dependency for something Node already does.
- An outage must not cause an alert storm: one alert, then silence until recovery.

## Trying a change against a real oracle

```bash
# in qeyro-fi-contracts
npx hardhat node
ATTESTERS=<addr0>,<addr1> THRESHOLD=2 npx hardhat run scripts/deploy.js --network localhost

# here, with a throwaway receiver on :9099 that prints POST bodies
export RPC_URL=http://127.0.0.1:8545 ORACLE_ADDRESS=<oracle> WEBHOOK_URLS=http://127.0.0.1:9099/hook POLL_SECONDS=1
node dist/cli.js run
```

Then change the oracle (propose, attest, execute) with `qeyro-fi-attester` and watch the receiver. To see staleness, advance the node's clock past `maxAge` (`evm_increaseTime`, then `evm_mine`).

## Commit messages

Say which alert or guarantee the change affects:

```
Hold the snapshot back when no webhook accepted an alert

Otherwise a webhook outage during a level change meant the change was never reported.
```

## Conduct

Be respectful and specific. See `CODE_OF_CONDUCT.md`.
