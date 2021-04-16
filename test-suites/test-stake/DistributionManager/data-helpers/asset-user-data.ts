import { BigNumber } from 'ethers';
import { AaveDistributionManager } from '../../../../types/AaveDistributionManager';
import { AaveIncentivesController } from '../../../../types/AaveIncentivesController';
import { StakedAgfV2 } from '../../../../types/StakedAgfV2';

export type UserStakeInput = {
  underlyingAsset: string;
  stakedByUser: string;
  totalStaked: string;
};

export type UserPositionUpdate = UserStakeInput & {
  user: string;
};
export async function getUserIndex(
  distributionManager:
    | AaveDistributionManager
    | AaveIncentivesController
    | StakedAgfV2,
  user: string,
  asset: string
): Promise<BigNumber> {
  return await distributionManager.getUserAssetData(user, asset);
}
