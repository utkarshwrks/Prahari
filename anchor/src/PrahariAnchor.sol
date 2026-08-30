// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PrahariAnchor
/// @notice Anchors a case's Merkle root on chain so nobody can alter the record
///         after the fact without it being provable.
///
/// @dev WHAT GOES ON CHAIN, AND WHAT NEVER DOES.
///
///      Only 32-byte hashes. No handle, no wallet address, no name, no listing
///      text, no analyst identity. A public blockchain is permanent and world
///      readable; putting investigative PII there would be a far worse privacy
///      failure than the one this system exists to investigate.
///
///      The contract stores a commitment. The evidence stays on the police
///      network, and the chain proves only that it has not changed.
contract PrahariAnchor {
    struct Seal {
        uint64 timestamp;   // block time of anchoring
        uint32 leafCount;   // records committed by this root
        bytes32 caseRef;    // keccak of the case reference, never the case id itself
        address anchorer;   // who sealed it
    }

    /// @notice root => seal. A root can be anchored exactly once.
    mapping(bytes32 => Seal) public seals;

    address public immutable owner;
    mapping(address => bool) public anchorers;

    event Anchored(
        bytes32 indexed root,
        bytes32 indexed caseRef,
        uint32 leafCount,
        address indexed anchorer,
        uint64 timestamp
    );
    event AnchorerSet(address indexed who, bool allowed);

    error NotOwner();
    error NotAnchorer();
    error AlreadyAnchored(bytes32 root);
    error ZeroRoot();
    error ZeroLeaves();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @dev Sealing is restricted. An open anchor function lets anyone spam
    ///      roots and destroys the meaning of "this case was sealed by the
    ///      cyber cell at this time".
    modifier onlyAnchorer() {
        if (!anchorers[msg.sender]) revert NotAnchorer();
        _;
    }

    constructor() {
        owner = msg.sender;
        anchorers[msg.sender] = true;
        emit AnchorerSet(msg.sender, true);
    }

    function setAnchorer(address who, bool allowed) external onlyOwner {
        anchorers[who] = allowed;
        emit AnchorerSet(who, allowed);
    }

    /// @notice Anchor a case's Merkle root.
    /// @dev Reverts on a repeat root. Re-anchoring would let an operator
    ///      overwrite the timestamp of an earlier seal, which is precisely the
    ///      backdating the chain is here to prevent.
    function anchor(bytes32 root, bytes32 caseRef, uint32 leafCount) external onlyAnchorer {
        if (root == bytes32(0)) revert ZeroRoot();
        if (leafCount == 0) revert ZeroLeaves();
        if (seals[root].timestamp != 0) revert AlreadyAnchored(root);

        seals[root] = Seal({
            timestamp: uint64(block.timestamp),
            leafCount: leafCount,
            caseRef: caseRef,
            anchorer: msg.sender
        });

        emit Anchored(root, caseRef, leafCount, msg.sender, uint64(block.timestamp));
    }

    /// @notice Was this root anchored, and when?
    /// @return timestamp 0 when the root was never anchored.
    function verify(bytes32 root)
        external
        view
        returns (uint64 timestamp, uint32 leafCount, bytes32 caseRef, address anchorer)
    {
        Seal memory s = seals[root];
        return (s.timestamp, s.leafCount, s.caseRef, s.anchorer);
    }

    function isAnchored(bytes32 root) external view returns (bool) {
        return seals[root].timestamp != 0;
    }
}
