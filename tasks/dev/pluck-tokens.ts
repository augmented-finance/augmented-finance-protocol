import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { loadPoolConfig, ConfigNames } from '../../helpers/configuration';
import { falsyOrZeroAddress, getFirstSigner } from '../../helpers/misc-utils';
import { eNetwork } from '../../helpers/types';
import {
  getIErc20Detailed,
  getLendingPoolProxy,
  getMarketAddressController,
} from '../../helpers/contracts-getters';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';

task('dev:pluck-tokens', 'Pluck tokens from whales to deployer for tests')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('mustDeposit', 'Enforces deposit')
  .setAction(async ({ pool, mustDeposit }, DRE) => {
    await DRE.run('set-DRE');

    const network = <eNetwork>DRE.network.name;
    const poolConfig = loadPoolConfig(pool);

    if (poolConfig.ForkTest.DonatePct == 0) {
      return;
    }

    const deployer = await getFirstSigner();
    const donors = Object.entries(getParamPerNetwork(poolConfig.ForkTest.Donors, network));
    const assets = getParamPerNetwork(poolConfig.ReserveAssets, network);
    const donatePct = poolConfig.ForkTest.DonatePct;
    const depositPct = poolConfig.ForkTest.AutoDepositPct;
    let receiver = poolConfig.ForkTest.DonateTo;

    const addressProvider = await getMarketAddressController();
    const lendingPool = await getLendingPoolProxy(await addressProvider.getLendingPool());

    if (falsyOrZeroAddress(receiver)) {
      receiver = deployer.address;
    }

    if (!donors || donors.length == 0) {
      console.log(`Plucking not configured`);
      if (mustDeposit) {
        throw `Plucking not configured`;
      }
      return;
    }

    let hasDeposits = false;

    console.log(`Plucking from ${donors.length} donors(s) to ${receiver}`);

    const holders = new Set<string>();

    for (const [tokenName, tokenHolder] of donors) {
      const tokenAddress = assets[tokenName];
      if (falsyOrZeroAddress(tokenHolder) || falsyOrZeroAddress(tokenAddress)) {
        console.log(`\tSkipped plucking ${tokenName} from ${tokenHolder}`);
        continue;
      }

      const holder = await impersonateAndGetSigner(DRE, tokenHolder);
      if (!holders.has(tokenHolder.toUpperCase())) {
        holders.add(tokenHolder.toUpperCase());
        await deployer.sendTransaction({
          to: tokenHolder,
          value: (<any>DRE).ethers.utils.hexlify(1e15),
        });
      }

      const token = await getIErc20Detailed(tokenAddress);
      const decimals = await token.decimals();

      const balance = await token.balanceOf(tokenHolder);

      const donation = balance.mul(mustDeposit ? 0 : donatePct).div(100);
      if (donation.gt(0)) {
        await token
          .connect(holder)
          .transfer(receiver, donation, { gasLimit: 1000000, gasPrice: 1 });
      }

      let canDepositToken = false;
      const deposit = balance.mul(mustDeposit && depositPct == 0 ? 20 : depositPct).div(100);
      if (deposit.gt(0)) {
        await token
          .connect(holder)
          .transfer(deployer.address, deposit, { gasLimit: 1000000, gasPrice: 1 });

        const rd = await lendingPool.getReserveData(tokenAddress);
        canDepositToken = !falsyOrZeroAddress(rd.aTokenAddress);

        if (canDepositToken) {
          await token
            .connect(deployer)
            .approve(lendingPool.address, deposit, { gasLimit: 1000000, gasPrice: 1 });
          await lendingPool.connect(deployer).deposit(token.address, deposit, deployer.address, 0);
          hasDeposits = true;
        }
      }

      let factor: BigNumber;
      let divisor: number;
      if (decimals > 3) {
        divisor = 10 ** 3;
        factor = BigNumber.from(10).pow(decimals - 3);
      } else {
        divisor = 10 ** decimals;
        factor = BigNumber.from(1);
      }

      BigNumber.from(10).pow(decimals - 3);
      if (donation.gt(0)) {
        console.log(
          `\t${tokenName}: ${donation.div(factor).toNumber() / divisor} plucked from ${tokenHolder}`
        );
      }
      if (deposit.gt(0)) {
        console.log(
          `\t${tokenName}: ${deposit.div(factor).toNumber() / divisor} plucked & ${
            canDepositToken ? 'deposited' : 'skipped deposit'
          } from ${tokenHolder}`
        );
      }
    }

    if (mustDeposit && !hasDeposits) {
      throw `Deposits were not done`;
    }
  });

const impersonateAndGetSigner = async (rawBRE, addr: string): Promise<SignerWithAddress> => {
  await rawBRE.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [addr],
  });
  return rawBRE.ethers.getSigner(addr);
};
