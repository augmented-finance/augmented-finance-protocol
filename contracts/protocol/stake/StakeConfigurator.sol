// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {VersionedInitializable} from '../../tools/upgradeability/VersionedInitializable.sol';
import {IMarketAccessController} from '../../access/interfaces/IMarketAccessController.sol';
import {MarketAccessBitmask} from '../../access/MarketAccessBitmask.sol';
import {Errors} from '../../tools/Errors.sol';
import {IStakeConfigurator} from './interfaces/IStakeConfigurator.sol';
import {IInitializableStakeToken} from './interfaces/IInitializableStakeToken.sol';
import {StakeTokenConfig} from './interfaces/StakeTokenConfig.sol';

contract StakeConfigurator is
  MarketAccessBitmask(IMarketAccessController(0)),
  VersionedInitializable,
  IStakeConfigurator
{
  uint256 private constant CONFIGURATOR_REVISION = 1;

  function getRevision() internal pure virtual override returns (uint256) {
    return CONFIGURATOR_REVISION;
  }

  // This initializer is invoked by AccessController.setAddressAsImpl
  function initialize(address addressesProvider) external initializer(CONFIGURATOR_REVISION) {
    _remoteAcl = IMarketAccessController(addressesProvider);
  }

  function buildInitStakeData() public onlyRewardAdmin returns (StakeInitData[] memory) {}

  function batchInitStakeTokens(StakeInitData[] memory input) public onlyRewardAdmin {
    for (uint256 i = 0; i < input.length; i++) {
      initStakeToken(input[i]);
    }
  }

  function initStakeToken(StakeInitData memory input) private returns (address) {
    StakeTokenConfig memory config =
      StakeTokenConfig(
        _remoteAcl,
        IERC20(input.stakedToken),
        0,
        0
        // input.cooldownPeriod,
        // input.unstakePeriod
      );

    bytes memory params =
      abi.encodeWithSelector(
        IInitializableStakeToken.initialize.selector,
        config,
        input.stkTokenName,
        input.stkTokenSymbol,
        input.stkTokenDecimals
      );

    return address(_remoteAcl.createProxy(address(this), input.stakeTokenImpl, params));
  }
}
