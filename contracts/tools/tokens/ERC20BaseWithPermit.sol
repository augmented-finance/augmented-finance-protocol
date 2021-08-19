// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './ERC20Base.sol';
import './ERC20PermitBase.sol';

abstract contract ERC20BaseWithPermit is ERC20Base, ERC20PermitBase {
  constructor(
    string memory name_,
    string memory symbol_,
    uint8 decimals_
  ) ERC20Base(name_, symbol_, decimals_) ERC20PermitBase() {}

  function _approveByPermit(
    address owner,
    address spender,
    uint256 amount
  ) internal override {
    _approve(owner, spender, amount);
  }

  function _getPermitDomainName() internal view override returns (bytes memory) {
    return bytes(super.name());
  }
}
