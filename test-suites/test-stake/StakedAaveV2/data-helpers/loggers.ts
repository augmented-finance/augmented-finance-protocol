import { tEthereumAddress } from '../../helpers/types';
import { ERC20 } from '../../../../types/ERC20';
import { StakedAaveV2 } from '../../../../types/StakedAaveV2';

export const logAaveTokenBalanceOf = async (
  account: tEthereumAddress,
  aaveToken: ERC20
) => {
  console.log(
    `[aaveToken.balanceOf(${account})]: ${(await aaveToken.balanceOf(account)).toString()}`
  );
};

export const logStakedAaveBalanceOf = async (
  staker: tEthereumAddress,
  stakedAaveV2: StakedAaveV2
) => {
  console.log(
    `[stakedAaveV2.balanceOf(${staker})]: ${(await stakedAaveV2.balanceOf(staker)).toString()}`
  );
};

export const logGetStakeTotalRewardsBalance = async (
  staker: tEthereumAddress,
  stakedAaveV2: StakedAaveV2
) => {
  console.log(
    `[stakedAaveV2.getTotalRewardsBalance(${staker})]: ${(
      await stakedAaveV2.getTotalRewardsBalance(staker)
    ).toString()}`
  );
};

export const logRewardPerStakedAave = async (stakedAaveV2: StakedAaveV2) => {
  console.log(
    `[stakedAaveV2.getRewardPerStakedAave()]: ${(
      await stakedAaveV2.getRewardPerStakedAave()
    ).toString()}`
  );
};
