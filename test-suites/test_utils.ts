import { currentTick, mineTicks, mineToTicks, nextTicks, nextToTicks } from './test-augmented/utils';
import _ from 'underscore';
import { ONE_ADDRESS } from '../helpers/constants';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BigNumberish } from 'ethers';

import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { tEthereumAddress } from '../helpers/types';

chai.use(solidity);
const { expect } = chai;

export interface UserBalanceChange {
  Signer: SignerWithAddress;
  Pool: any;
  TokenAddress: tEthereumAddress;
  TicksFromStart: number;
  AmountDepositedBefore: BigNumberish;
  AmountDeposited: BigNumberish;
  TotalAmountDeposited: BigNumberish;
}

export interface TestInfo {
  TotalRewardTicks: number;
  UserBalanceChanges: UserBalanceChange[];
  TicksToMeltdown: number;
  FreezePercentage: BigNumberish;
}

const printTestInfo = (s: Object) => {
  const replacer = (k, v) => {
    if (k === 'Pool') {
      return v.address;
    } else if (k === 'Signer') {
      return v.address;
    } else {
      return v;
    }
  };
  console.log(`test params: ${JSON.stringify(s, replacer, 2)}`);
};

// used in test to perform "work" in pools by depositing by different users
// parsing TestInfo struct and applying deposits in different blocks then claims all rewards
export const applyDepositPlanAndClaimAll = async (ti: TestInfo, controller: any) => {
  printTestInfo(ti);
  const startTick = await currentTick();
  console.log(`current tick: ${startTick}`);
  // applying balance changes in order
  ti.UserBalanceChanges = _.sortBy(ti.UserBalanceChanges, 'block');

  // let totalSetupTicks = 0;
  for (let u of ti.UserBalanceChanges) {
    // mine to set balance update for relative block
    if (u.TicksFromStart > 0) {
      await nextTicks(u.TicksFromStart);
    }
    await u.Pool.handleBalanceUpdate(
      u.TokenAddress,
      u.Signer.address,
      u.AmountDepositedBefore,
      u.AmountDeposited,
      u.TotalAmountDeposited
    );
  }
  const uniq_addresses = [...new Set(ti.UserBalanceChanges.map((item) => item.Signer.address))];
  // mine the rest blocks until ti.TotalRewardTicks,
  // subtract already mined blocks + blocks with claims afterwards
  await mineToTicks(startTick + ti.TotalRewardTicks - uniq_addresses.length + 1);
  // claim for every user only once
  for (let ua of uniq_addresses) {
    for (let s of ti.UserBalanceChanges) {
      if (ua === s.Signer.address) {
        await controller.connect(s.Signer).claimReward();
        break;
      }
    }
  }
//  await mineToTicks(startTick + ti.TotalRewardTicks);
};
