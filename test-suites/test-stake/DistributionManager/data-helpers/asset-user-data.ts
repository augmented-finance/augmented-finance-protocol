import { BigNumber } from 'ethers';
import { AaveDistributionManager } from '../../../../types/AaveDistributionManager';
import { AaveIncentivesController } from '../../../../types/AaveIncentivesController';
import { StakedAgfV1 } from '../../../../types/StakedAgfV1';

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
    | StakedAgfV1,
  user: string,
  asset: string
): Promise<BigNumber> {
  return await distributionManager.getUserAssetData(user, asset);
}
