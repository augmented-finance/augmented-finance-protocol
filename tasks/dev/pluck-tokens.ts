import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { loadPoolConfig, ConfigNames } from '../../helpers/configuration';
import { falsyOrZeroAddress, getFirstSigner } from '../../helpers/misc-utils';
import { eNetwork } from '../../helpers/types';
import { getIErc20Detailed } from '../../helpers/contracts-getters';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { WAD, WAD_NUM } from '../../helpers/constants';

task('dev:pluck-tokens', 'Pluck tokens from whales to deployer for tests')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE) => {
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
    let receivers = poolConfig.ForkTest.To;

    // if (!receivers || receivers.length === 0) {
    //   receivers = [deployer.address];
    // }

    if (!donors || donors.length == 0) {
      console.log(`Plucking not configured`);
      return;
    }

    for (const receiver of receivers) {
      console.log(`Plucking from ${donors.length} donors(s) to ${receiver}`);

      const holders = new Set<string>();

      for (const [tokenName, tokenHolder] of donors) {
        const tokenAddress = assets[tokenName];
        if (falsyOrZeroAddress(tokenHolder) || falsyOrZeroAddress(tokenAddress)) {
          console.log(`\tSkipped plucking ${tokenName} from ${tokenHolder}`);
          continue;
        }

        const holder = await impersonateAndGetSigner(DRE, tokenHolder);
        if (!holders.has(tokenHolder)) {
          holders.add(tokenHolder);
          await deployer.sendTransaction({
            to: tokenHolder,
            value: (<any>DRE).ethers.utils.hexlify(1e15),
          });
        }

        const token = await getIErc20Detailed(tokenAddress);
        const decimals = await token.decimals();

        const balance = await token.balanceOf(tokenHolder);
        const donation = balance.mul(donatePct).div(100);
        await token.connect(holder).transfer(receiver, donation, {
          gasLimit: 1000000,
          gasPrice: 1,
        });

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
        console.log(
          `\tPlucked ${donation.div(factor).toNumber() / divisor} ${tokenName} from ${tokenHolder}`
        );
      }
    }
  });

const impersonateAndGetSigner = async (rawBRE, addr: string): Promise<SignerWithAddress> => {
  await rawBRE.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [addr],
  });
  return rawBRE.ethers.getSigner(addr);
};
