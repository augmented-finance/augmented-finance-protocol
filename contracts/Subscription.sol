// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {IERC20} from './dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from './dependencies/openzeppelin/contracts/SafeERC20.sol';

import 'hardhat/console.sol';

/**
 * @title Subscription Contract
 * @notice
 * @author Augmented Finance
 */
contract Subscription {
  using SafeERC20 for IERC20;
  struct BlockDeposit {
    uint256 blockNumber;
    uint256 amount;
  }

  mapping(address => BlockDeposit[]) private deposits;

  address public tokenAddress;

  constructor(address tokenAddress_) public {
    tokenAddress = tokenAddress_;
  }

  event Subscribed(address sender, uint256 amount, uint256 blockNumber);
  event Unsubscribed(address sender, uint256 amount);

  function subscribeForDeposit(uint256 amount) public returns (uint256 amount_) {
    require(amount > 0, 'Non zero amount is required');
    IERC20 token = IERC20(tokenAddress);
    if (!token.transferFrom(msg.sender, address(this), amount)) {
      return 0;
    }

    if (deposits[msg.sender].length > 0) {
      uint256 last = deposits[msg.sender].length - 1;
      if (deposits[msg.sender][last].blockNumber == block.number) {
        uint256 newAmount = deposits[msg.sender][last].amount + amount;
        if (newAmount > deposits[msg.sender][last].amount) {
          deposits[msg.sender][last].amount = newAmount;
          emit Subscribed(msg.sender, amount, block.number);
          return amount;
        }
      }
    }
    deposits[msg.sender].push(BlockDeposit(block.number, amount));
    emit Subscribed(msg.sender, amount, block.number);
    return amount;
  }

  function unsubscribeDeposit(uint256 maxAmount) public returns (uint256) {
    uint256 allocate = 0;
    for (uint256 last = deposits[msg.sender].length; last > 0; ) {
      last--;

      if (deposits[msg.sender][last].amount > (maxAmount - allocate)) {
        deposits[msg.sender][last].amount -= (maxAmount - allocate);
        allocate = maxAmount;
        break;
      }

      allocate += deposits[msg.sender][last].amount;
      deposits[msg.sender].pop();
    }

    IERC20 token = IERC20(tokenAddress);
    if (!token.approve(msg.sender, allocate)) {
      revert();
    }
    // emit Unsubscribed(msg.sender, allocate);
    return allocate;
  }

  function executeDeposit(
    address owner,
    uint256 mul,
    uint256 div
  ) public returns (uint256 amount, bool completed) {
    uint256 safeLimit = ~uint256(0);
    if (div < mul) {
      safeLimit /= mul;
      safeLimit *= div;
    }

    completed = true;
    uint256 subscribed = 0;
    for (uint256 last = deposits[owner].length; last > 0; ) {
      last--;
      uint256 safeCap = safeLimit - subscribed;
      if (safeCap == 0) {
        completed = false;
        break;
      }

      if (deposits[owner][last].amount <= safeCap) {
        subscribed += deposits[owner][last].amount;
        deposits[owner].pop();
        continue;
      }

      deposits[owner][last].amount -= safeCap;
      subscribed = safeLimit;
      completed = false;
      break;
    }

    if (completed) {
      delete deposits[owner];
    }

    uint256 allocate = subscribed / div;
    allocate *= mul;
    allocate += ((subscribed % div) * mul) / div;

    IERC20 token = IERC20(tokenAddress);
    if (!token.approve(owner, allocate)) {
      revert();
    }

    if (completed) {
      console.log('complete deposit execution', allocate);
    } else {
      console.log('partial deposit execution', allocate);
    }

    return (allocate, completed);
  }

  function subscriptionTotal(address subscriber)
    public
    view
    returns (uint256 amount, bool withoutOverflow)
  {
    for (uint256 last = deposits[subscriber].length; last > 0; ) {
      last--;
      uint256 newAmount = amount + deposits[subscriber][last].amount;
      if (newAmount < amount) {
        return (amount, false);
      }
      amount = newAmount;
    }
    return (amount, true);
  }
}
