import type { Address, Hex } from "viem";

/** Everything the monitor needs to know about the oracle at one moment. */
export interface Snapshot {
  /** Unix seconds of the block the data was read at. */
  at: number;
  blockNumber: number;
  level: number;
  levelName: string;
  /** Last update is within the oracle's maxAge (the contract's own answer). */
  fresh: boolean;
  lastUpdate: number;
  maxAge: number;
  threshold: number;
  attesters: number;
  proposalCount: number;
  evidenceHash: Hex;
  sourceURI: string;
}

export type AlertKind =
  | "level_raised"
  | "level_lowered"
  | "level_refreshed"
  | "became_stale"
  | "became_fresh"
  | "new_proposal"
  | "quorum_changed"
  | "rpc_unreachable"
  | "rpc_recovered"
  | "started";

export type Severity = "info" | "warning" | "critical";

export interface Alert {
  kind: AlertKind;
  severity: Severity;
  title: string;
  detail: string;
  /** Unix seconds when the monitor produced the alert. */
  at: number;
  snapshot?: Snapshot;
}

export interface State {
  version: 1;
  last?: Snapshot;
  rpcFailures: number;
  rpcDown: boolean;
}

export interface Context {
  oracle: Address;
  chainId: number;
}
