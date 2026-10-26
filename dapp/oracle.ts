import { createPublicClient, http, type Address, type Hex, type PublicClient } from "viem";
import { levelName } from "./levels.js";
import type { Snapshot } from "./types.js";

const abi = [
  { type: "function", name: "threatLevel", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "lastUpdate", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "maxAge", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "threshold", stateMutability: "view", inputs: [], outputs: [{ type: "uint32" }] },
  { type: "function", name: "attesterCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint32" }] },
  { type: "function", name: "proposalCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "isFresh", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "evidenceHash", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "sourceURI", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

export function makeClient(rpcUrl: string): PublicClient {
  return createPublicClient({ transport: http(rpcUrl, { retryCount: 1, timeout: 12_000 }) }) as PublicClient;
}

/**
 * Read the oracle at one block. Every call is pinned to the same block number so the snapshot
 * cannot mix values from two different blocks.
 */
export async function readSnapshot(client: PublicClient, oracle: Address): Promise<Snapshot> {
  const block = await client.getBlock({ blockTag: "latest" });
  const blockNumber = block.number;
  const c = { address: oracle, abi, blockNumber } as const;
  const [level, lastUpdate, maxAge, threshold, attesters, proposals, fresh, evidence, uri] = await Promise.all([
    client.readContract({ ...c, functionName: "threatLevel" }),
    client.readContract({ ...c, functionName: "lastUpdate" }),
    client.readContract({ ...c, functionName: "maxAge" }),
    client.readContract({ ...c, functionName: "threshold" }),
    client.readContract({ ...c, functionName: "attesterCount" }),
    client.readContract({ ...c, functionName: "proposalCount" }),
    client.readContract({ ...c, functionName: "isFresh" }),
    client.readContract({ ...c, functionName: "evidenceHash" }),
    client.readContract({ ...c, functionName: "sourceURI" }),
  ]);
  return {
    at: Number(block.timestamp),
    blockNumber: Number(blockNumber),
    level,
    levelName: levelName(level),
    fresh,
    lastUpdate: Number(lastUpdate),
    maxAge: Number(maxAge),
    threshold,
    attesters,
    proposalCount: Number(proposals),
    evidenceHash: evidence as Hex,
    sourceURI: uri,
  };
}
