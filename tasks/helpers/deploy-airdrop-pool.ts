import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { ICommonConfiguration, IPermiRewardPool, tEthereumAddress } from '../../helpers/types';
import { deployNamedPermitFreezerRewardPool } from '../../helpers/contracts-deployments';
import { oneWad, ZERO_ADDRESS } from '../../helpers/constants';
import { falsyOrZeroAddress, mustWaitTx } from '../../helpers/misc-utils';
import { getDeployAccessController } from '../../helpers/deploy-helpers';
import { getRewardBooster, getRewardConfiguratorProxy } from '../../helpers/contracts-getters';
import { AccessFlags } from '../../helpers/access-flags';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { task } from 'hardhat/config';

task(`helper:deploy-airdrop`, `Deploy airdrop pool`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const poolConfig = loadPoolConfig(pool);

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();
    const rewardController = await getRewardBooster(await addressProvider.getAddress(AccessFlags.REWARD_CONTROLLER));

    const configurator = await getRewardConfiguratorProxy(
      await addressProvider.getAddress(AccessFlags.REWARD_CONFIGURATOR)
    );
    const poolAddrs: tEthereumAddress[] = [];
    const poolNames: string[] = [];
    const poolFactors: number[] = [];

    const deployPermitPool = async (poolName: string, params?: IPermiRewardPool) => {
      if (!params || params.TotalWad == 0) {
        return;
      }

      const unlockTimestamp = (params.MeltDownAt.getTime() / 1000) | 0;

      const brp = await deployNamedPermitFreezerRewardPool(
        poolName,
        [rewardController.address, oneWad.multipliedBy(params.TotalWad).toFixed(), unlockTimestamp],
        verify
      );

      if (params.Providers.length > 0) {
        console.log(`Adding providers to ${poolName}: ${params.Providers.length}`);
        for (const value of params.Providers) {
          if (!falsyOrZeroAddress(value)) {
            await mustWaitTx(brp.addRewardProvider(value, ZERO_ADDRESS));
          }
        }
      }

      poolAddrs.push(brp.address);
      poolNames.push(poolName);
      poolFactors.push(params.BoostFactor);

      console.log(
        `Deployed ${poolName}: ${brp.address}, limit ${params.TotalWad} wad, melts at ${params.MeltDownAt} (${unlockTimestamp})`
      );
    };

    const { RewardParams } = poolConfig as ICommonConfiguration;
    const rewardParams = getParamPerNetwork(RewardParams.RewardPools);

    await deployPermitPool('AirdropPool', rewardParams.AirdropPool);
    if (poolAddrs.length > 0) {
      console.log(poolAddrs, poolNames, poolFactors);
      // await mustWaitTx(configurator.addNamedRewardPools(poolAddrs, poolNames, poolFactors));

      console.log(`Deployed ${poolNames.join(', ')}: ${poolAddrs}`);
      // extraNames.push(...poolNames);
    }
  });
