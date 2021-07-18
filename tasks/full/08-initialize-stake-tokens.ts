import { task } from 'hardhat/config';
import { exit } from 'process';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { loadPoolConfig, ConfigNames, getWethAddress } from '../../helpers/configuration';
import {
  deployStakeConfiguratorImpl,
  deployStakeTokenImpl,
} from '../../helpers/contracts-deployments';
import { eNetwork, ICommonConfiguration, StakeMode } from '../../helpers/types';
import {
  getIErc20Detailed,
  getLendingPoolProxy,
  getMarketAddressController,
  getStakeConfiguratorImpl,
} from '../../helpers/contracts-getters';
import { chunk, falsyOrZeroAddress, getFirstSigner, waitForTx } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import { BigNumberish } from 'ethers';

const CONTRACT_NAME = 'StakeToken';

task(`full:init-stake-tokens`, `Deploys stake tokens for prod enviroment`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getMarketAddressController();

    const impl = await deployStakeTokenImpl(verify);
    console.log(`Deployed ${CONTRACT_NAME}.address`, impl.address);

    const { ReserveAssets, Names } = poolConfig as ICommonConfiguration;

    const stakeConfigurator = await getStakeConfiguratorImpl(
      await addressesProvider.getStakeConfigurator()
    );

    const reserveAssets = getParamPerNetwork(ReserveAssets, network);
    const lendingPool = await getLendingPoolProxy(await addressesProvider.getLendingPool());
    let initParams: {
      stakeTokenImpl: string;
      stakedToken: string;
      stkTokenName: string;
      stkTokenSymbol: string;
      cooldownPeriod: BigNumberish;
      unstakePeriod: BigNumberish;
      stkTokenDecimals: BigNumberish;
      maxSlashable: BigNumberish;
    }[] = [];
    let initSymbols: string[] = [];

    const stakeParams = poolConfig.StakeParams;
    for (const [tokenName, mode] of Object.entries(stakeParams.StakeToken)) {
      if (mode == undefined) {
        continue;
      }
      let asset = reserveAssets[tokenName];

      if (asset && mode == StakeMode.stakeAg) {
        const reserveData = await lendingPool.getReserveData(asset);
        asset = reserveData.aTokenAddress;
      }
      if (falsyOrZeroAddress(asset)) {
        console.log('Stake asset is missing:', tokenName, mode);
        continue;
      }

      {
        const existingToken = await stakeConfigurator.stakeTokenOf(asset);
        if (!falsyOrZeroAddress(existingToken)) {
          console.log('Stake asset is present:', tokenName, existingToken);
          continue;
        }
      }

      const assetDetailed = await getIErc20Detailed(asset);
      const decimals = await assetDetailed.decimals();

      const symbol = tokenName; // await assetDetailed.symbol();

      initSymbols.push(symbol);
      initParams.push({
        stakeTokenImpl: impl.address,
        stakedToken: asset,
        stkTokenName: `${Names.StakeTokenNamePrefix} ${tokenName}`,
        stkTokenSymbol: `${Names.StakeSymbolPrefix}${Names.SymbolPrefix}${symbol}`,
        stkTokenDecimals: decimals,
        cooldownPeriod: stakeParams.CooldownPeriod,
        unstakePeriod: stakeParams.UnstakePeriod,
        maxSlashable: stakeParams.MaxSlashBP,
      });
    }

    // CHUNK CONFIGURATION
    const initChunks = 1;

    const chunkedParams = chunk(initParams, initChunks);
    const chunkedSymbols = chunk(initSymbols, initChunks);

    await waitForTx(
      await addressesProvider.grantRoles((await getFirstSigner()).address, AccessFlags.STAKE_ADMIN)
    );

    console.log(`- Stakes initialization with ${chunkedParams.length} txs`);
    for (let chunkIndex = 0; chunkIndex < chunkedParams.length; chunkIndex++) {
      const param = chunkedParams[chunkIndex];
      console.log(param);
      const tx3 = await waitForTx(
        await stakeConfigurator.batchInitStakeTokens(param, {
          gasLimit: 5000000,
        })
      );

      console.log(`  - Stake(s) ready for: ${chunkedSymbols[chunkIndex].join(', ')}`);
      console.log('    * gasUsed', tx3.gasUsed.toString());
    }
  });
