// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';
import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {Context} from '../dependencies/openzeppelin/contracts/Context.sol';
import {ERC20WithPermit} from '../misc/ERC20WithPermit.sol';
import {AccessBitmask} from '../misc/AccessBitmask.sol';

import {IRewardMinter} from './IRewardMinter.sol';

import 'hardhat/console.sol';

contract AGFToken is Context, ERC20WithPermit, AccessBitmask, Ownable, IRewardMinter {
  uint256 public constant aclMint = 1 << 0;
  uint256 public constant aclBurn = 1 << 1;
  uint256 public constant aclSuspended = 1 << 2;
  uint256 internal immutable aclPermanentMask = aclSuspended;

  address[] private _knownGrantees;

  constructor(string memory name, string memory symbol) public ERC20WithPermit(name, symbol) {}

  function admin_grant(address addr, uint256 flags) external onlyOwner {
    require(addr != address(0), 'address is required');
    if ((_getAcl(addr) & ~aclPermanentMask == 0) && (flags & ~aclPermanentMask != 0)) {
      _knownGrantees.push(addr);
    }
    _grantAcl(addr, flags);
  }

  function admin_revoke(address addr, uint256 flags) external onlyOwner {
    require(addr != address(0), 'address is required');
    _revokeAcl(addr, flags);
  }

  function admin_revokeAllBenefits() external onlyOwner {
    if (_knownGrantees.length == 0) {
      return;
    }
    for (uint256 i = _knownGrantees.length; i > 0; ) {
      i--;
      _revokeAcl(_knownGrantees[i], ~aclPermanentMask);
    }
  }

  function granted(address addr) external view returns (uint256) {
    return _getAcl(addr);
  }

  function granteesWithBenefits() external view returns (address[] memory) {
    return _knownGrantees;
  }

  function mintReward(address account, uint256 amount) external override aclHas(aclMint) {
    _mint(account, amount);
  }

  function burnReward(address account, uint256 amount) external aclHas(aclBurn) {
    _burn(account, amount);
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256
  ) internal virtual override {
    require(_getAcl(from) & aclSuspended == 0, 'sender is suspended');
    require(_getAcl(to) & aclSuspended == 0, 'receiver is suspended');
  }
}
