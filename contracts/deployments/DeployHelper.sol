// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {LendingPool} from '../protocol/lendingpool/LendingPool.sol';
import {LendingPoolConfigurator} from '../protocol/lendingpool/LendingPoolConfigurator.sol';
import {DepositToken} from '../protocol/tokenization/DepositToken.sol';
import {
  DefaultReserveInterestRateStrategy
} from '../protocol/lendingpool/DefaultReserveInterestRateStrategy.sol';
import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';

import {IPriceOracleProvider} from '../interfaces/IPriceOracleProvider.sol';
import {IMarketAccessController} from '../access/interfaces/IMarketAccessController.sol';

contract DeployHelper is Ownable {
  event deployedContract(uint256 index, address a);

  struct InitDeploymentInput {
    address asset;
    uint256[6] rates;
  }

  struct ConfigureReserveInput {
    address asset;
    uint256 baseLTV;
    uint256 liquidationThreshold;
    uint256 liquidationBonus;
    uint256 reserveFactor;
    bool stableBorrowingEnabled;
  }

  function deployRateStrategies(
    IPriceOracleProvider provider,
    InitDeploymentInput[] calldata inputParams
  ) external onlyOwner {
    for (uint256 i = 0; i < inputParams.length; i++) {
      emit deployedContract(
        i,
        address(
          new DefaultReserveInterestRateStrategy(
            provider,
            inputParams[i].rates[0],
            inputParams[i].rates[1],
            inputParams[i].rates[2],
            inputParams[i].rates[3],
            inputParams[i].rates[4],
            inputParams[i].rates[5]
          )
        )
      );
    }
  }

  function configureReserves(
    IMarketAccessController provider,
    ConfigureReserveInput[] calldata inputParams
  ) external onlyOwner {
    LendingPoolConfigurator configurator =
      LendingPoolConfigurator(provider.getLendingPoolConfigurator());

    for (uint256 i = 0; i < inputParams.length; i++) {
      configurator.configureReserveAsCollateral(
        inputParams[i].asset,
        inputParams[i].baseLTV,
        inputParams[i].liquidationThreshold,
        inputParams[i].liquidationBonus
      );

      configurator.enableBorrowingOnReserve(
        inputParams[i].asset,
        inputParams[i].stableBorrowingEnabled
      );
      configurator.setReserveFactor(inputParams[i].asset, inputParams[i].reserveFactor);
    }
  }
}
