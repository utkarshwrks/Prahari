// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PrahariAnchor} from "../src/PrahariAnchor.sol";

contract PrahariAnchorTest is Test {
    PrahariAnchor anchorC;
    address owner = address(this);
    address stranger = address(0xBEEF);

    bytes32 constant ROOT = keccak256("case-001-root");
    bytes32 constant CASE = keccak256("CASE-001");

    function setUp() public {
        anchorC = new PrahariAnchor();
    }

    function test_AnchorStoresTheSeal() public {
        anchorC.anchor(ROOT, CASE, 4);
        (uint64 ts, uint32 n, bytes32 c, address who) = anchorC.verify(ROOT);
        assertGt(ts, 0);
        assertEq(n, 4);
        assertEq(c, CASE);
        assertEq(who, owner);
    }

    function test_VerifyReturnsZeroForUnknownRoot() public view {
        (uint64 ts,,,) = anchorC.verify(keccak256("never-sealed"));
        assertEq(ts, 0);
        assertFalse(anchorC.isAnchored(keccak256("never-sealed")));
    }

    /// @dev Re-anchoring would let an operator overwrite an earlier seal's
    ///      timestamp -- exactly the backdating the chain prevents.
    function test_DoubleAnchorReverts() public {
        anchorC.anchor(ROOT, CASE, 4);
        vm.expectRevert(abi.encodeWithSelector(PrahariAnchor.AlreadyAnchored.selector, ROOT));
        anchorC.anchor(ROOT, CASE, 4);
    }

    function test_NonAnchorerReverts() public {
        vm.prank(stranger);
        vm.expectRevert(PrahariAnchor.NotAnchorer.selector);
        anchorC.anchor(ROOT, CASE, 4);
    }

    function test_NonOwnerCannotGrantAnchorer() public {
        vm.prank(stranger);
        vm.expectRevert(PrahariAnchor.NotOwner.selector);
        anchorC.setAnchorer(stranger, true);
    }

    function test_OwnerCanGrantAndRevoke() public {
        anchorC.setAnchorer(stranger, true);
        vm.prank(stranger);
        anchorC.anchor(ROOT, CASE, 1);
        assertTrue(anchorC.isAnchored(ROOT));

        anchorC.setAnchorer(stranger, false);
        vm.prank(stranger);
        vm.expectRevert(PrahariAnchor.NotAnchorer.selector);
        anchorC.anchor(keccak256("another"), CASE, 1);
    }

    function test_ZeroRootReverts() public {
        vm.expectRevert(PrahariAnchor.ZeroRoot.selector);
        anchorC.anchor(bytes32(0), CASE, 1);
    }

    function test_ZeroLeavesReverts() public {
        vm.expectRevert(PrahariAnchor.ZeroLeaves.selector);
        anchorC.anchor(ROOT, CASE, 0);
    }

    function test_AnchoredEventIsEmitted() public {
        vm.expectEmit(true, true, true, true);
        emit PrahariAnchor.Anchored(ROOT, CASE, 4, owner, uint64(block.timestamp));
        anchorC.anchor(ROOT, CASE, 4);
    }

    /// @dev Replaying another case's seal must not silently succeed: the root
    ///      is the key, so a replay is caught as a double anchor (D3.3 #4).
    function test_ReplayOfAnotherCasesSealReverts() public {
        anchorC.anchor(ROOT, CASE, 4);
        vm.expectRevert(abi.encodeWithSelector(PrahariAnchor.AlreadyAnchored.selector, ROOT));
        anchorC.anchor(ROOT, keccak256("CASE-999"), 4);
    }

    function test_GasIsAroundSeventyThousand() public {
        uint256 before = gasleft();
        anchorC.anchor(ROOT, CASE, 4);
        uint256 used = before - gasleft();
        emit log_named_uint("anchor() gas", used);
        assertLt(used, 120_000);
    }

    function testFuzz_DistinctRootsCoexist(bytes32 a, bytes32 b) public {
        vm.assume(a != b && a != bytes32(0) && b != bytes32(0));
        anchorC.anchor(a, CASE, 1);
        anchorC.anchor(b, CASE, 1);
        assertTrue(anchorC.isAnchored(a) && anchorC.isAnchored(b));
    }
}
