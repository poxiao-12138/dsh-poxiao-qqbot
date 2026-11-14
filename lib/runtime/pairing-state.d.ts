import type { PairChallenge } from '../shared/pairing-protocol.ts';
/** Revocation is authorization state, independent of best-effort claim receipts. */
export interface StoredPairChallenge extends PairChallenge {
    readonly revokedOpenids: string[];
}
/** Short-lived bearer codes remain private and survive a profile-triggered reload. */
export declare function readPairingState(path: string): StoredPairChallenge[];
export declare function writePairingState(path: string, challenges: StoredPairChallenge[]): void;
//# sourceMappingURL=pairing-state.d.ts.map