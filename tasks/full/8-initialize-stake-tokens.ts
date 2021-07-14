import { task } from 'hardhat/config';
import { exit } from 'process';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { loadPoolConfig, ConfigNames, getWethAddress } from '../../helpers/configuration';
import {
  deployStakeConfiguratorImpl,
  deployStakeTokenImpl,
} from '../../helpers/contracts-deployments';
import { eNetwork, ICommonConfiguration, StakeMode } from '../../helpers/types';
import { getLendingPool, getMarketAddressController } from '../../helpers/contracts-getters';
import { waitForTx } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import { StakeConfiguratorFactory } from '../../types';
import { BigNumberish } from 'ethers';

const CONTRACT_NAME = 'StakeToken';

task(`full:init-stake-tokens`, `Deploys stake tokens for prod enviroment`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    try {
      //       await localBRE.run('set-DRE');
      //       const network = <eNetwork>localBRE.network.name;
      //       const poolConfig = loadPoolConfig(pool);
      //       const addressesProvider = await getMarketAddressController();
      //       const impl = await deployStakeTokenImpl(verify);
      //       await waitForTx(await addressesProvider.addImplementation(`${CONTRACT_NAME}`, impl.address));
      //       const {
      //         ReserveAssets,
      //       } = poolConfig as ICommonConfiguration;
      //       const reserveAssets = getParamPerNetwork(ReserveAssets, network);
      //       const lendingPool = await getLendingPool(await addressesProvider.getLendingPool());
      //       let initParams: {
      //         stakeTokenImpl: string;
      //         stakedToken: string;
      //         stkTokenName: string;
      //         stkTokenSymbol: string;
      //         cooldownPeriod: BigNumberish;
      //         unstakePeriod: BigNumberish;
      //         stkTokenDecimals: BigNumberish;
      //       }[] = [];
      //       const stakeParams = poolConfig.StakeParams;
      //       const stakeTokens = Object.entries(stakeParams.StakeToken);
      //       for (const [tokenName, mode] of stakeTokens) {
      //         if (mode == StakeMode.noStake) {
      //           continue;
      //         }
      //         let asset = reserveAssets[tokenName];
      //         if (asset && mode == StakeMode.stakeAg) {
      //           const reserveData = await lendingPool.getReserveData(asset);
      //           asset = reserveData.aTokenAddress;
      //         }
      //         initParams.push({
      //           stakeTokenImpl : impl.address,
      //           stakedToken : asset,
      //           stkTokenName : '',
      //           stkTokenSymbol : '',
      //           stkTokenDecimals : 0,
      //           cooldownPeriod : 0,
      //           unstakePeriod : 0,
      //         });
      //       };
      //       const stakeConfigurator = StakeConfiguratorFactory.connect(await addressesProvider.getStakeConfigurator(), await getFirstSigner());
      //       // stakeConfigurator.set
      //       stakeConfigurator.batchInitStakeTokens()
      // //      lendingPoolAddress
      //       console.log(`${CONTRACT_NAME}.address`, impl.address);
      //       console.log(`\tFinished ${CONTRACT_NAME} deployment`);
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });
