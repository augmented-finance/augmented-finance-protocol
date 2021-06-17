import { currentBlock, mineBlocks } from './test-augmented/utils';
import _ from 'underscore';
import { ONE_ADDRESS } from '../helpers/constants';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BigNumberish } from 'ethers';

import chai from 'chai';
import { solidity } from 'ethereum-waffle';

chai.use(solidity);
const { expect } = chai;

export interface UserBalanceChange {
  Signer: SignerWithAddress;
  TokenAddress: any;
  BlocksFromStart: number;
  AmountDepositedBefore: BigNumberish;
  AmountDeposited: BigNumberish;
  TotalAmountDeposited: BigNumberish;
}

export interface TestInfo {
  TotalRewardBlocks: number;
  UserBalanceChanges: UserBalanceChange[];
  BlocksToMeltdown: number;
  FreezePercentage: BigNumberish;
}

const printTestInfo = (s: Object) => {
  console.log(`test params: ${JSON.stringify(s, null, 2)}`);
};

// used in test to perform "work" in pools by depositing by different users
// parsing TestInfo struct and applying deposits in different blocks then claims all rewards
export const applyDepositPlanAndClaimAll = async (ti: TestInfo, pool: any, controller: any) => {
  printTestInfo(ti);
  console.log(`current block: ${await currentBlock()}`);
  // applying balance changes in order
  ti.UserBalanceChanges = _.sortBy(ti.UserBalanceChanges, 'block');

  let totalSetupBlocks = 0;
  for (let u of ti.UserBalanceChanges) {
    // mine to set balance update for relative block
    if (u.BlocksFromStart !== 0) {
      totalSetupBlocks += await mineBlocks(u.BlocksFromStart);
    }
    await pool.handleBalanceUpdate(
      u.TokenAddress,
      u.Signer.address,
      u.AmountDepositedBefore,
      u.AmountDeposited,
      u.TotalAmountDeposited
    );
  }
  const uniq_addresses = [...new Set(ti.UserBalanceChanges.map((item) => item.Signer.address))];
  // mine the rest blocks until ti.TotalRewardBlocks,
  // subtract already mined blocks + blocks with claims afterwards
  await mineBlocks(ti.TotalRewardBlocks - totalSetupBlocks - uniq_addresses.length);
  // claim for every user only once
  for (let ua of uniq_addresses) {
    for (let s of ti.UserBalanceChanges) {
      if (ua === s.Signer.address) {
        await controller.connect(s.Signer).claimReward();
      }
    }
  }
};
