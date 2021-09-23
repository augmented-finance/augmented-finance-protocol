import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { loadPoolConfig, ConfigNames } from '../../helpers/configuration';
import {
  deployDepositStakeTokenImpl,
  deployPriceFeedUniEthPair,
  deployStakeTokenImpl,
} from '../../helpers/contracts-deployments';
import { eNetwork, ICommonConfiguration, StakeMode, tEthereumAddress } from '../../helpers/types';
import {
  getIErc20Detailed,
  getIInitializableStakeToken,
  getIUniswapV2Factory,
  getIUniswapV2Router02,
  getLendingPoolProxy,
  getOracleRouter,
  getStakeConfiguratorImpl,
  getStaticPriceOracle,
} from '../../helpers/contracts-getters';
import { addProxyToJsonDb, chunk, falsyOrZeroAddress, mustWaitTx, waitTx } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import { BigNumberish } from 'ethers';
import { getDeployAccessController } from '../../helpers/deploy-helpers';
import { WAD, ZERO_ADDRESS } from '../../helpers/constants';
import { addFullStep } from '../helpers/full-steps';

addFullStep(9, 'Deploy and initialize stake tokens', 'full:init-stake-tokens');

task(`full:init-stake-tokens`, `Deploys stake tokens`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify contracts via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    const { ReserveAssets, Names, Dependencies } = poolConfig as ICommonConfiguration;
    const dependencies = getParamPerNetwork(Dependencies, network);

    const stakeConfigurator = await getStakeConfiguratorImpl(
      await addressProvider.getAddress(AccessFlags.STAKE_CONFIGURATOR)
    );

    const reserveAssets = getParamPerNetwork(ReserveAssets, network);
    const lendingPool = await getLendingPoolProxy(await addressProvider.getLendingPool());
    let initParams: {
      stakeTokenImpl: string;
      stakedToken: string;
      strategy: string;
      stkTokenName: string;
      stkTokenSymbol: string;
      cooldownPeriod: BigNumberish;
      unstakePeriod: BigNumberish;
      stkTokenDecimals: BigNumberish;
      maxSlashable: BigNumberish;
      depositStake: boolean;
    }[] = [];
    let initSymbols: string[] = [];

    const stakeParams = poolConfig.StakeParams;
    let stakeImplAddr: tEthereumAddress = '';
    let depositStakeImplAddr: tEthereumAddress = '';

    const getStakeImplAddr = async () => {
      if (falsyOrZeroAddress(stakeImplAddr)) {
        const impl = await deployStakeTokenImpl(verify, continuation);
        console.log(`Deployed StakeToken implementation:`, impl.address);
        stakeImplAddr = impl.address;
      }
      return stakeImplAddr;
    };

    const getDepositStakeImplAddr = async () => {
      if (falsyOrZeroAddress(depositStakeImplAddr)) {
        const impl = await deployDepositStakeTokenImpl(verify, continuation);
        console.log(`Deployed DepositStakeToken implementation:`, impl.address);
        depositStakeImplAddr = impl.address;
      }
      return depositStakeImplAddr;
    };

    const listPricedSymbols: string[] = [];
    const listStakedTokens: string[] = [];
    const listPricingAssets: string[] = [];
    const listStaticPrices: string[] = [];

    const customPriceFeed = 'custom';

    for (const [tokenName, mode] of Object.entries(stakeParams.StakeToken)) {
      if (mode == undefined) {
        continue;
      }
      const reserveAsset = reserveAssets[tokenName];
      let asset = reserveAsset;
      if (falsyOrZeroAddress(asset)) {
        console.log(`Token ${tokenName} has an invalid address, skipping`);
        continue;
      }

      if (falsyOrZeroAddress(asset)) {
        console.log('Stake asset is missing:', tokenName, mode);
        continue;
      }

      const depositStake: boolean = mode == StakeMode.stakeAg;
      if (depositStake) {
        const reserveData = await lendingPool.getReserveData(asset);
        asset = reserveData.depositTokenAddress;
      }
      if (falsyOrZeroAddress(asset)) {
        console.log('Stake asset is missing:', tokenName, mode);
        continue;
      }

      const symbol = tokenName; // await assetDetailed.symbol();
      const stkTokenName = `${Names.StakeTokenNamePrefix} ${tokenName}`;
      const stkTokenSymbol = `${Names.StakeSymbolPrefix}${Names.SymbolPrefix}${symbol}`;

      if (depositStake) {
        listPricedSymbols.push(stkTokenSymbol);
        listPricingAssets.push(reserveAsset);
        listStakedTokens.push(asset);
        listStaticPrices.push(tokenName === 'WETH' ? WAD : '');
      }

      {
        const existingToken = await stakeConfigurator.stakeTokenOf(asset);
        if (!falsyOrZeroAddress(existingToken)) {
          console.log('Stake asset is present:', tokenName, existingToken);
          if (freshStart && !continuation) {
            throw 'duplicate stake asset: ' + tokenName;
          }
          continue;
        }
      }

      const tokenImplAddr = depositStake ? await getDepositStakeImplAddr() : await getStakeImplAddr();
      const assetDetailed = await getIErc20Detailed(asset);
      const decimals = await assetDetailed.decimals();

      initSymbols.push(symbol);
      initParams.push({
        stakeTokenImpl: tokenImplAddr,
        stakedToken: asset,
        strategy: ZERO_ADDRESS,
        stkTokenName: stkTokenName,
        stkTokenSymbol: stkTokenSymbol,
        stkTokenDecimals: decimals,
        cooldownPeriod: stakeParams.CooldownPeriod,
        unstakePeriod: stakeParams.UnstakePeriod,
        maxSlashable: stakeParams.MaxSlashBP,
        depositStake: depositStake,
      });
    }

    if (!falsyOrZeroAddress(dependencies.UniswapV2Router)) {
      const uniswapRouter = await getIUniswapV2Router02(dependencies.UniswapV2Router!);
      const weth = await uniswapRouter.WETH();
      const uniswapFactory = await getIUniswapV2Factory(await uniswapRouter.factory());
      const agfAddr = await addressProvider.getAddress(AccessFlags.REWARD_TOKEN);
      const lpPairAddr = await uniswapFactory.getPair(weth, agfAddr);

      if (falsyOrZeroAddress(lpPairAddr)) {
        console.log('\tUniswap Pair ETH-AGF not found');
      } else {
        const symbol = 'UniV2ETHAGF';
        const stkTokenName = `${Names.StakeTokenNamePrefix} ${symbol}`;
        const stkTokenSymbol = `${Names.StakeSymbolPrefix}${Names.SymbolPrefix}${symbol}`;

        const tokenImplAddr = await getStakeImplAddr();
        const lpPair = await getIErc20Detailed(lpPairAddr);
        const decimals = await lpPair.decimals();

        initSymbols.push(symbol);
        initParams.push({
          stakeTokenImpl: tokenImplAddr,
          stakedToken: lpPairAddr,
          strategy: ZERO_ADDRESS,
          stkTokenName: stkTokenName,
          stkTokenSymbol: stkTokenSymbol,
          stkTokenDecimals: decimals,
          cooldownPeriod: stakeParams.CooldownPeriod,
          unstakePeriod: stakeParams.UnstakePeriod,
          maxSlashable: stakeParams.MaxSlashBP,
          depositStake: false,
        });

        const feed = await deployPriceFeedUniEthPair(symbol, [lpPairAddr], verify);
        console.log('\tUni ETH-pair price feed:', symbol, feed.address);

        listPricedSymbols.push(stkTokenSymbol);
        listPricingAssets.push(feed.address);
        listStakedTokens.push(lpPairAddr);
        listStaticPrices.push(customPriceFeed);
      }
    }

    if (initSymbols.length > 0) {
      // CHUNK CONFIGURATION
      const initChunks = 4;

      const chunkedParams = chunk(initParams, initChunks);
      const chunkedSymbols = chunk(initSymbols, initChunks);

      console.log(`- Stakes initialization with ${chunkedParams.length} txs`);
      for (let chunkIndex = 0; chunkIndex < chunkedParams.length; chunkIndex++) {
        const param = chunkedParams[chunkIndex];
        console.log(param);
        const tx3 = await mustWaitTx(
          stakeConfigurator.batchInitStakeTokens(param, {
            gasLimit: 4000000,
          })
        );

        console.log(`  - Stake(s) ready for: ${chunkedSymbols[chunkIndex].join(', ')}`);
        console.log('    * gasUsed', tx3.gasUsed.toString());
      }

      console.log('Check stake tokens and collect verification data');
      for (const params of initParams) {
        const proxyAddr = await stakeConfigurator.stakeTokenOf(params.stakedToken);
        if (falsyOrZeroAddress(proxyAddr)) {
          throw 'Missing stake token: ' + params.stkTokenSymbol;
        }
        const implAddr = params.stakeTokenImpl;
        console.log('\t', params.stkTokenSymbol, proxyAddr, implAddr);

        if (!verify) {
          continue;
        }

        const v = await getIInitializableStakeToken(proxyAddr);
        const data = v.interface.encodeFunctionData('initializeStakeToken', [
          {
            stakeController: stakeConfigurator.address,
            stakedToken: params.stakedToken,
            strategy: params.strategy,
            cooldownPeriod: params.cooldownPeriod,
            unstakePeriod: params.unstakePeriod,
            maxSlashable: params.maxSlashable,
            stakedTokenDecimals: params.stkTokenDecimals,
          },
          params.stkTokenName,
          params.stkTokenSymbol,
        ]);
        await addProxyToJsonDb('STAKE_TOKEN_' + params.stkTokenSymbol, proxyAddr, implAddr, 'stakeToken', [
          stakeConfigurator.address,
          implAddr,
          data,
        ]);
      }
    }

    if (listStakedTokens.length > 0) {
      const po = await getOracleRouter(await addressProvider.getAddress(AccessFlags.PRICE_ORACLE));

      const staticTokens: string[] = [];
      const staticPrices: string[] = [];
      const priceTokens: string[] = [];
      const priceSources: string[] = [];

      console.log('Set price stubs for stake tokens: ', listPricedSymbols);
      for (let i = 0; i < listStakedTokens.length; i++) {
        const stakedToken = listStakedTokens[i];
        const stakeToken = await stakeConfigurator.stakeTokenOf(stakedToken);
        const priceAsset = listPricingAssets[i];

        if (falsyOrZeroAddress(stakeToken)) {
          throw 'Missing stake token:' + listPricedSymbols[i];
        }

        let priceFound = true;
        let source = await po.getSourceOfAsset(stakedToken);
        if (falsyOrZeroAddress(source)) {
          try {
            // check for static price
            await po.getAssetPrice(stakedToken);
          } catch {
            priceFound = false;
          }
        }
        if (priceFound) {
          console.log('\tPrice found:', listPricedSymbols[i]);
          continue;
        }

        const staticPrice = listStaticPrices[i];
        if (staticPrice == '') {
          source = await po.getSourceOfAsset(priceAsset);
          if (falsyOrZeroAddress(source)) {
            console.log('\tPrice source is missing for underlying of', listPricedSymbols[i], stakedToken);
            continue;
          }

          console.log('\tPrice source by underlying: ', listPricedSymbols[i], stakedToken, source);
          priceTokens.push(stakedToken);
          priceSources.push(source);
        } else if (staticPrice == customPriceFeed) {
          console.log('\tCustom price source: ', listPricedSymbols[i], stakedToken, priceAsset);
          priceTokens.push(stakedToken);
          priceSources.push(priceAsset);
        } else {
          console.log('\tStatic price:', listPricedSymbols[i], stakedToken, staticPrice);
          staticTokens.push(stakedToken);
          staticPrices.push(staticPrice);
        }
      }

      if (staticTokens.length > 0) {
        const fb = await getStaticPriceOracle(await po.getFallbackOracle());
        console.log('Apply', staticTokens.length, 'static price(s)');
        const callData = fb.interface.encodeFunctionData('setAssetPrices', [staticTokens, staticPrices]);
        await waitTx(
          addressProvider.callWithRoles([
            { accessFlags: AccessFlags.ORACLE_ADMIN, callFlag: 0, callAddr: fb.address, callData: callData },
          ])
        );
      }

      if (priceTokens.length > 0) {
        console.log('Apply', priceTokens.length, 'price source(s)');
        const callData = po.interface.encodeFunctionData('setAssetSources', [priceTokens, priceSources]);
        await waitTx(
          addressProvider.callWithRoles([
            { accessFlags: AccessFlags.ORACLE_ADMIN, callFlag: 0, callAddr: po.address, callData: callData },
          ])
        );
      }
    }
  });
