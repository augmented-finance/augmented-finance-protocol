import BigNumber from 'bignumber.js';
import { PERC_100, RAY } from '../../../../helpers/constants';

export const calcTeamRewardForMember = (
  blocksPassed: number,
  teamRewardInitialRate: string,
  memberShare: number,
  teamRewardsFreezePercentage: number
): number => {
  console.log(`blocks passed: ${blocksPassed}`);
  const rewardForBlock = new BigNumber(teamRewardInitialRate).div(RAY);
  console.log(`one block gives rewards: ${rewardForBlock.toFixed()}`);
  // reward consists of
  // number of blocks passed * reward for block * userShare (PCT) / 10000 (10k = 100%)
  const reward = (blocksPassed * rewardForBlock.toNumber() * memberShare) / PERC_100;
  // minus percentage of freezed reward
  const minusFreezedPart = (reward * (PERC_100 - teamRewardsFreezePercentage)) / PERC_100;
  console.log(`reward: ${reward}`);
  console.log(`total reward multiplied by freeze percentage: ${minusFreezedPart}`);
  return minusFreezedPart;
};
