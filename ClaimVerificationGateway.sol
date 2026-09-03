// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Tracks spent nullifiers so a valid proof can be used exactly once
/// per verifier/session. Mirrors NullifierRegistry.consume() in zk_core.js --
/// same interface, on-chain instead of in-memory.
contract NullifierRegistry {
    mapping(uint256 => bool) private _used;

    event NullifierConsumed(uint256 indexed nullifierHash, address indexed verifier);

    error NullifierAlreadyUsed(uint256 nullifierHash);

    function isUsed(uint256 nullifierHash) external view returns (bool) {
        return _used[nullifierHash];
    }

    /// @dev Reverts if this exact nullifier was already consumed by ANYONE,
    /// not just this caller -- a leaked proof is worthless the moment its
    /// first legitimate use lands on-chain.
    function consume(uint256 nullifierHash) external {
        if (_used[nullifierHash]) revert NullifierAlreadyUsed(nullifierHash);
        _used[nullifierHash] = true;
        emit NullifierConsumed(nullifierHash, msg.sender);
    }
}

/// @notice Publishes Merkle roots for claim trees with a timestamp, so a
/// curator cannot silently swap a root after the fact -- any change is a new
/// entry, and old roots remain queryable forever.
contract ClaimRootRegistry {
    struct RootEntry {
        uint256 root;
        uint256 publishedAt;
    }

    // claimId (as uint256, e.g. truncated sha256) => history of published roots
    mapping(uint256 => RootEntry[]) private _roots;

    event RootPublished(uint256 indexed claimId, uint256 root, uint256 index);

    function publishRoot(uint256 claimId, uint256 root) external {
        _roots[claimId].push(RootEntry({ root: root, publishedAt: block.timestamp }));
        emit RootPublished(claimId, root, _roots[claimId].length - 1);
    }

    function latestRoot(uint256 claimId) external view returns (uint256 root, uint256 publishedAt) {
        uint256 len = _roots[claimId].length;
        require(len > 0, "no root published for this claim");
        RootEntry storage e = _roots[claimId][len - 1];
        return (e.root, e.publishedAt);
    }

    function rootHistoryLength(uint256 claimId) external view returns (uint256) {
        return _roots[claimId].length;
    }
}

/// @notice Ties verification + nullifier consumption + root freshness into a
/// single call, so a verifier contract can't forget to check the nullifier
/// (the most common real-world bug in these systems). The actual Groth16
/// pairing check lives in the separate generated `Verifier` contract
/// (pgx_verifier.sol, exported directly from the circuit's proving key via
/// `snarkjs zkey export solidityverifier` -- never hand-written, since a
/// hand-written pairing check is exactly the kind of subtle bug that defeats
/// the whole point of using a SNARK).
/// @dev Signature matches the ACTUAL generated Groth16Verifier.verifyProof()
/// exactly -- 6 public signals, confirmed against pgx_membership_v2.sym:
///   [0] nullifierHash  [1] root  [2] claimId  [3] issuerAx  [4] issuerAy  [5] verifierId
/// This order comes from circom's own convention (outputs first, then public
/// inputs in declaration order) -- it is NOT something the contract author
/// gets to choose, so it must be read from the compiled circuit, not assumed.
interface IGroth16Verifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[6] calldata publicSignals
    ) external view returns (bool);
}

contract ClaimVerificationGateway {
    IGroth16Verifier public immutable groth16Verifier;
    NullifierRegistry public immutable nullifiers;
    ClaimRootRegistry public immutable roots;

    event ClaimVerified(uint256 indexed claimId, uint256 indexed nullifierHash, address indexed verifier);

    constructor(address groth16VerifierAddr, address nullifierRegistryAddr, address rootRegistryAddr) {
        groth16Verifier = IGroth16Verifier(groth16VerifierAddr);
        nullifiers = NullifierRegistry(nullifierRegistryAddr);
        roots = ClaimRootRegistry(rootRegistryAddr);
    }

    /// @param publicSignals exactly as returned by snarkjs: [nullifierHash, root, claimId, issuerAx, issuerAy, verifierId]
    function verifyAndConsume(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[6] calldata publicSignals
    ) external returns (bool) {
        uint256 nullifierHash = publicSignals[0];
        uint256 root = publicSignals[1];
        uint256 claimId = publicSignals[2];

        (uint256 currentRoot, ) = roots.latestRoot(claimId);
        require(root == currentRoot, "proof against stale or unknown root");

        bool valid = groth16Verifier.verifyProof(a, b, c, publicSignals);
        require(valid, "invalid proof");

        nullifiers.consume(nullifierHash); // reverts if replayed

        emit ClaimVerified(claimId, nullifierHash, msg.sender);
        return true;
    }
}
