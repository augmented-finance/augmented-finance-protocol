import { task } from 'hardhat/config';
import { loadPoolConfig, ConfigNames, getWethAddress } from '../../helpers/configuration';
import {
  eContractid,
  eNetwork,
  ICommonConfiguration,
  ITokenRewardPoolParams,
} from '../../helpers/types';
import {
  getMarketAddressController,
  getRewardConfiguratorProxy,
} from '../../helpers/contracts-getters';
import { chunk, getFirstSigner, waitForTx } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import { BigNumber, BigNumberish } from 'ethers';
import { RAY } from '../../helpers/constants';

task(`full:init-misc-reward-pools`, `Deploys miscellaneous reward pools`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify contracts via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getMarketAddressController();

    const { ReserveAssets, RewardParams, Names } = poolConfig as ICommonConfiguration;

    let initParams: {
      provider: string;
      impl: string;
      baselinePercentage: BigNumberish;
      initialRate: BigNumberish;
      rateScale: BigNumberish;
    }[] = [];
    let initSymbols: string[] = [];

    let totalShare = 0;

    const rewardParams = RewardParams; // getParamPerNetwork(RewardParams, network);
    const initialRate = BigNumber.from(RAY).mul(rewardParams.InitialRate);

    // if (tokenParams.Share.stake != undefined) {
    //   const share = tokenParams.Share.stake;
    //   const token = await stakeConfigurator.stakeTokenOf(asset);
    //   if (!falsyOrZeroAddress(token)) {
    //     totalShare += share;
    //     initParams.push({
    //       provider: token,
    //       baselinePercentage: share,
    //       rateScale: rateScale,
    //       initialRate: initialRate.mul(share).div(10000),
    //       impl: poolImpl.address,
    //     });
    //     initSymbols.push(Names.StableDebtSymbolPrefix + symbol);
    //   }
    // }

    console.log(`Total reward share: ${(0.0 + totalShare) / 100.0}%`);
    if (totalShare > 10000) {
      throw `excessive total reward share`;
    }

    // CHUNK CONFIGURATION
    const initChunks = 1;

    const chunkedParams = chunk(initParams, initChunks);
    const chunkedSymbols = chunk(initSymbols, initChunks);

    await waitForTx(
      await addressesProvider.grantRoles(
        (await getFirstSigner()).address,
        AccessFlags.REWARD_CONFIG_ADMIN
      )
    );

    const configurator = await getRewardConfiguratorProxy(
      await addressesProvider.getRewardConfigurator()
    );

    console.log(`- Reward pools initialization with ${chunkedParams.length} txs`);
    for (let chunkIndex = 0; chunkIndex < chunkedParams.length; chunkIndex++) {
      const param = chunkedParams[chunkIndex];
      console.log(param);
      const tx3 = await waitForTx(
        await configurator.batchInitRewardPools(param, {
          gasLimit: 5000000,
        })
      );

      console.log(`  - Pool(s) ready for: ${chunkedSymbols[chunkIndex].join(', ')}`);
      console.log('    * gasUsed', tx3.gasUsed.toString());
    }
  });
