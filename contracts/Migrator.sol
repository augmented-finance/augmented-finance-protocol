// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {IERC20} from './dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from './dependencies/openzeppelin/contracts/SafeERC20.sol';
import {IAToken} from './interfaces/IAToken.sol';
import {ILendingPool} from './interfaces/ILendingPool.sol';

import 'hardhat/console.sol';

interface IDerivedToken is IERC20 {
  function UNDERLYING_ASSET_ADDRESS() external returns (address);
}

interface IWithdrawablePool {
  function withdraw(
    address asset,
    uint256 amount,
    address to
  ) external returns (uint256);
}

interface IRedeemableToken is IERC20 {
  function POOL() external returns (IWithdrawablePool);
}

interface ILendableToken is IERC20 {
  function POOL() external returns (ILendingPool);
}

/**
 * @title Subscription Contract
 * @notice
 * @author Augmented Finance
 */
contract AaveMigrator {
  using SafeERC20 for IERC20;

  address internal _underlyingToken;
  address internal _originToken;
  address internal _targetToken;

  constructor(address originToken, address targetToken) public {
    require(originToken != targetToken, 'same origin and target');
    _underlyingToken = IDerivedToken(targetToken).UNDERLYING_ASSET_ADDRESS();
    require(
      _underlyingToken == IDerivedToken(originToken).UNDERLYING_ASSET_ADDRESS(),
      'different underlyings'
    );
    require(address(IRedeemableToken(originToken).POOL()) != address(0), 'origin pool is required');
    require(address(ILendableToken(targetToken).POOL()) != address(0), 'target pool is required');
    _originToken = originToken;
    _targetToken = targetToken;
  }

  function ORIGIN_ASSET_ADDRESS() public view returns (address) {
    return _originToken;
  }

  function TARGET_ASSET_ADDRESS() public view returns (address) {
    return _targetToken;
  }

  function UNDERLYING_ASSET_ADDRESS() public view returns (address) {
    return _underlyingToken;
  }

  function migrate(uint256 amount, uint16 referralCode) public returns (uint256) {
    // TODO referal code should be uint256
    require(amount > 0, 'Non zero amount is required');
    IERC20(_originToken).safeTransferFrom(msg.sender, address(this), amount);

    uint256 withdrawnAmount =
      IRedeemableToken(_originToken).POOL().withdraw(_underlyingToken, amount, address(this));
    if (withdrawnAmount == 0) {
      return 0;
    }

    ILendableToken(_targetToken).POOL().deposit(
      _underlyingToken,
      withdrawnAmount,
      msg.sender,
      referralCode
    );
    return withdrawnAmount;
  }
}
