// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {IERC20} from './dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from './dependencies/openzeppelin/contracts/SafeERC20.sol';
import {Ownable} from './dependencies/openzeppelin/contracts/Ownable.sol';

import 'hardhat/console.sol';

interface IMigrator {
  function ORIGIN_ASSET_ADDRESS() external returns (address);

  function TARGET_ASSET_ADDRESS() external returns (address);

  function UNDERLYING_ASSET_ADDRESS() external returns (address);

  function migrate(uint256 amount, uint16 referralCode) external returns (uint256);
}

/**
 * @title Subscription Contract
 * @notice
 * @author Augmented Finance
 */
contract Subscription is Ownable {
  using SafeERC20 for IERC20;
  struct BlockDeposit {
    uint256 blockNumber;
    uint256 amount;
  }

  mapping(address => BlockDeposit[]) private deposits;

  address internal _originAddress;
  address internal _targetAddress;
  uint256 internal _originAmount;
  uint256 internal _targetAmount;

  constructor(address tokenAddress) public {
    require(tokenAddress != address(0), 'token address required');
    _originAddress = tokenAddress;
  }

  modifier notMigrated() {
    require(_targetAddress == address(0), 'migration completed');
    _;
  }

  modifier migrated() {
    require(_targetAddress != address(0), 'migration pending');
    _;
  }

  event Subscribed(address indexed sender, uint256 amount, uint256 blockNumber);
  event Unsubscribed(address indexed sender, uint256 amount);

  function subscribeForDeposit(uint256 amount) public notMigrated returns (uint256 amount_) {
    require(amount > 0, 'Non zero amount is required');
    IERC20(_originAddress).safeTransferFrom(msg.sender, address(this), amount);
    // TODO check for possible total balance overflow?

    if (deposits[msg.sender].length > 0) {
      uint256 last = deposits[msg.sender].length - 1;
      if (deposits[msg.sender][last].blockNumber == block.number) {
        uint256 newAmount = deposits[msg.sender][last].amount + amount;
        require(newAmount > deposits[msg.sender][last].amount, 'balance overflow');

        deposits[msg.sender][last].amount = newAmount;
        emit Subscribed(msg.sender, amount, block.number);
        return amount;
      }
    }
    deposits[msg.sender].push(BlockDeposit(block.number, amount));
    emit Subscribed(msg.sender, amount, block.number);
    return amount;
  }

  function unsubscribeDeposit(uint256 maxAmount) public notMigrated returns (uint256) {
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

    // TODO Should be IERC20(_originAddress).safeTransfer(msg.sender, allocate);
    if (!IERC20(_originAddress).approve(msg.sender, allocate)) {
      revert();
    }

    emit Unsubscribed(msg.sender, allocate);
    return allocate;
  }

  function migrateAll(address migrator) public onlyOwner notMigrated returns (uint256) {
    require(IMigrator(migrator).ORIGIN_ASSET_ADDRESS() == _originAddress, 'different origin token');
    _targetAddress = IMigrator(migrator).TARGET_ASSET_ADDRESS();
    require(_targetAddress != address(0), 'missing target token');

    address underlying = IMigrator(migrator).UNDERLYING_ASSET_ADDRESS();
    _originAmount = IERC20(underlying).balanceOf(address(this));
    if (_originAmount == 0) {
      return 0;
    }

    _targetAmount = IMigrator(migrator).migrate(uint256(-1), 0);
    require(IERC20(underlying).balanceOf(address(this)) == 0, 'partial migration');
    require(
      IERC20(_targetAddress).balanceOf(address(this)) == _targetAmount,
      'migrated tokens were not received'
    );

    // this only applies to AAVE tokens
    // require(_targetAmount == _originAmount, 'inconsistent migration');
    return _targetAmount;
  }

  function subscriptionTotal(address subscriber) public view returns (uint256 amount) {
    for (uint256 last = deposits[subscriber].length; last > 0; ) {
      last--;
      amount += deposits[subscriber][last].amount;
    }

    return amount;
  }

  function migratedTotal(address subscriber)
    public
    view
    returns (uint256 amount, bool migratedFlag)
  {
    if (_targetAddress == address(0)) {
      return (0, false);
    }
    return (migratedAmount(subscriptionTotal(subscriber)), true);
  }

  function migratedAmount(uint256 subscribedAmount) public view returns (uint256) {
    if (_originAmount == 0) {
      return 0;
    }
    if (_originAmount == _targetAmount) {
      return subscribedAmount;
    }
    uint256 rem = subscribedAmount % _originAmount;
    uint256 res = subscribedAmount / _originAmount;
    return (res * _targetAmount) + (rem * _targetAmount) / _originAmount;
  }

  function sendMigratedDeposit(address owner) public migrated returns (uint256 amount) {
    // TODO do a few iterations for large deposits (on overflow)
    amount = migratedAmount(subscriptionTotal(owner));
    delete deposits[owner];

    if (amount == 0) {
      return 0;
    }
    IERC20(_targetAddress).safeTransfer(owner, amount);
    return amount;
  }

  // function executeDeposit(
  //   address owner,
  //   uint256 mul,
  //   uint256 div
  // ) public onlyOwner() returns (uint256 amount, bool completed) {
  //   uint256 safeLimit = ~uint256(0);
  //   if (div < mul) {
  //     safeLimit /= mul;
  //     safeLimit *= div;
  //   }

  //   completed = true;
  //   uint256 subscribed = 0;
  //   for (uint256 last = deposits[owner].length; last > 0; ) {
  //     last--;
  //     uint256 safeCap = safeLimit - subscribed;
  //     if (safeCap == 0) {
  //       completed = false;
  //       break;
  //     }

  //     if (deposits[owner][last].amount <= safeCap) {
  //       subscribed += deposits[owner][last].amount;
  //       deposits[owner].pop();
  //       continue;
  //     }

  //     deposits[owner][last].amount -= safeCap;
  //     subscribed = safeLimit;
  //     completed = false;
  //     break;
  //   }

  //   if (completed) {
  //     delete deposits[owner];
  //   }

  //   uint256 allocate = subscribed / div;
  //   allocate *= mul;
  //   allocate += ((subscribed % div) * mul) / div;

  //   // TODO Should be IERC20(_originAddress).safeTransfer(owner, allocate);
  //   if (!IERC20(_originAddress).approve(owner, allocate)) {
  //     revert();
  //   }

  //   if (completed) {
  //     console.log('complete deposit execution', allocate);
  //   } else {
  //     console.log('partial deposit execution', allocate);
  //   }

  //   return (allocate, completed);
  // }
}
