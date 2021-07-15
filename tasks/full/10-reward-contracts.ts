import { task } from 'hardhat/config';
import { exit } from 'process';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { loadPoolConfig, ConfigNames, getWethAddress } from '../../helpers/configuration';
import {
  deployRewardTokenImpl,
  deployRewardBooster,
  deployRewardConfiguratorImpl,
  deployStakeConfiguratorImpl,
} from '../../helpers/contracts-deployments';
import { eNetwork } from '../../helpers/types';
import {
  getMarketAddressController,
  getRewardConfiguratorProxy,
} from '../../helpers/contracts-getters';
import { waitForTx } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import { MarketAccessController } from '../../types';

task(`full:deploy-reward-contracts`, `Deploys reward contracts for prod enviroment`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify contracts via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    try {
      await localBRE.run('set-DRE');
      const network = <eNetwork>localBRE.network.name;
      const poolConfig = loadPoolConfig(pool);
      const addressesProvider = await getMarketAddressController();

      // await waitForTx(
      //   await addressesProvider.setRewardTokenImpl(
      //     await deployContractImpl(
      //       addressesProvider,
      //       'AGFToken',
      //       await deploydeployRewardTokenImpl(verify)
      //     )
      //   )
      // );

      //       await waitForTx(
      //         await addressesProvider.setRewardConfiguratorImpl(
      //           await deployContractImpl(
      //             addressesProvider,
      //             'RewardConfigurator',
      //             await deployRewardConfiguratorImpl(verify)
      //           )
      //         )
      //       );

      //       const configurator = await getRewardConfiguratorProxy(await addressesProvider.getRewardConfigurator());
      // //      configurator

      //       const agfAddr = await addressesProvider.getRewardToken();

      //       await waitForTx(
      //         await addressesProvider.setRewardController(
      //           await deployContractImpl(
      //             addressesProvider,
      //             'RewardBooster',
      //             await deployRewardBooster([addressesProvider.address, agfAddr], verify)
      //           )
      //         )
      //       );
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });

export const deployContractImpl = async (
  ac: MarketAccessController,
  contractName: string,
  impl: any
) => {
  const implAddr: string = impl.address;

  await ac.addImplementation(contractName, implAddr);
  console.log(`${contractName}.address: `, implAddr);
  console.log(`\tFinished ${contractName} deployment`);
  return implAddr;
};
