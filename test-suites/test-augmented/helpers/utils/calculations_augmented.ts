import BigNumber from 'bignumber.js';
import { PERC_100, RAY } from '../../../../helpers/constants';

export const calcTeamRewardForMember = (
  ticksPassed: number,
  teamRewardInitialRate: string,
  memberShare: number,
  teamRewardsFreezePercentage: number
): number => {
  console.log(`blocks passed: ${ticksPassed}`);
  const rewardForTick = new BigNumber(teamRewardInitialRate);
  console.log(`one tick gives rewards: ${rewardForTick.toFixed()}`);
  // reward consists of
  const reward = (ticksPassed * rewardForTick.toNumber() * memberShare) / PERC_100;
  // minus percentage of freezed reward
  const minusFreezedPart = (reward * (PERC_100 - teamRewardsFreezePercentage)) / PERC_100;
  console.log(`reward: ${reward}`);
  console.log(`total reward multiplied by freeze percentage: ${minusFreezedPart}`);
  return minusFreezedPart;
};
