import { BigNumber } from '@ethersproject/bignumber';
import { splitSignature } from '@ethersproject/bytes';
import { _TypedDataEncoder } from '@ethersproject/hash';
import { formatEther, parseEther } from '@ethersproject/units';
import { Wallet } from '@ethersproject/wallet';
import { isHexPrefixed } from 'ethjs-util';
import { createReadStream, createWriteStream } from 'fs';
import { task, types } from 'hardhat/config';
import { exit } from 'process';
import { createInterface } from 'readline';
import { AccessFlags } from '../../helpers/access-flags';
import { BUIDLEREVM_CHAINID } from '../../helpers/buidler-constants';
import { oneEther, ZERO_ADDRESS } from '../../helpers/constants';
import {
  getMarketAccessController,
  getPermitFreezerRewardPool,
  getRewardConfiguratorProxy,
} from '../../helpers/contracts-getters';
import { buildRewardClaimPermitParams, encodeTypeHash } from '../../helpers/contracts-helpers';
import { falsyOrZeroAddress } from '../../helpers/misc-utils';
import { eNetwork } from '../../helpers/types';
import { getDefaultMarketAddressController } from '../helpers/utils';

task('sign-reward-permits', 'Sings permits for reward pools')
  .addOptionalParam('ctl', 'Address of MarketAddressController', ZERO_ADDRESS, types.string)
  .addOptionalParam('sk', 'SK (private key) or mnemonic for signer', '', types.string)
  .addParam('pool', 'Name or address of a permit reward pool', undefined, types.string)
  .addOptionalParam('out', 'File name for output', undefined, types.string)
  .addOptionalParam('limit', 'Limit for total balances', undefined, types.int)
  .addOptionalParam('deadline', 'Expiry date for claims', '2025-01-01', types.string)
  .addFlag('files', 'Force file names mode')
  .addFlag('encode', 'Encode call data')
  .addVariadicPositionalParam('args', 'Address-balance pairs or file names')
  .setAction(
    async ({ ctl, sk, pool: poolName, files, args, limit, out: outFile, deadline: deadlineStr, encode }, DRE) => {
      try {
        await DRE.run('set-DRE');

        ctl = await getDefaultMarketAddressController(<eNetwork>DRE.network.name, ctl);
        if (falsyOrZeroAddress(ctl)) {
          throw 'Controller is required';
        }
        console.log('\nController:', ctl);
        const ac = await getMarketAccessController(ctl);

        const newSK = sk == 'new';
        const signer = createWallet(newSK ? '' : sk);
        if (newSK) {
          console.log('\nMenomic:\n', signer.mnemonic);
          console.log();
        }

        if (poolName === undefined) {
          throw 'Reward pool is required';
        }

        let poolAddr = '';
        if (isHexPrefixed(poolName)) {
          poolAddr = poolName;
        } else {
          const rc = await getRewardConfiguratorProxy(await ac.getAddress(AccessFlags.REWARD_CONFIGURATOR));
          poolAddr = (await rc.getNamedRewardPools([poolName]))[0];
        }
        if (falsyOrZeroAddress(poolAddr)) {
          throw 'Reward pool is unknown: ' + poolName;
        }

        let domainParams = {
          name: '',
          revision: '1',
          chainId: DRE.network.config.chainId || BUIDLEREVM_CHAINID,
          contract: poolAddr,
        };

        const pool = await getPermitFreezerRewardPool(poolAddr);
        try {
          domainParams.name = await pool.getPoolName();

          const params = buildRewardClaimPermitParams(domainParams);

          const actualTH = await pool.CLAIM_TYPEHASH();
          const expectedTH = encodeTypeHash(params.primaryType, params.types);
          if (actualTH.toLocaleLowerCase() != expectedTH.toLocaleLowerCase()) {
            throw 'Typehash mismatched: ' + expectedTH + ', ' + actualTH;
          }
        } catch (err) {
          console.error(err);
          throw 'Reward pool is not a compatible claim permit pool: ' + poolName + ', ' + poolAddr;
        }

        const findSeparator = (s: string): number => {
          let pos = s.indexOf(';');
          if (pos < 0) {
            pos = s.indexOf(':');
            if (pos < 0) {
              pos = s.indexOf('=');
            }
          }
          return pos;
        };

        let totalAmount = BigNumber.from(0);
        let errorCount = 0;
        const uniqueAddrs = new Map<string, BigNumber>();

        const parseEntry = (s: string) => {
          const pos = findSeparator(s);
          if (pos < 0) {
            console.log('\tSeparator not found:', s);
            errorCount++;
            return;
          }

          let addr = s.substring(0, pos).trim();
          if (!isHexPrefixed(addr)) {
            addr = unquote(addr).trim();
          }
          if (falsyOrZeroAddress(addr)) {
            console.log('\tInvalid spender:', addr);
            errorCount++;
            return;
          }
          if (uniqueAddrs.has(addr.toLocaleLowerCase())) {
            console.log('\tDuplicate spender:', addr);
            errorCount++;
            return;
          }
          uniqueAddrs.set(addr.toLocaleLowerCase(), BigNumber.from(0));

          let amount: BigNumber;
          try {
            let vs = s.substring(pos + 1).trim();
            const sPos = vs.indexOf(' ');
            if (sPos > 0) {
              vs = vs.substring(0, sPos);
            }
            amount = parseEther(vs);
          } catch (err) {
            console.log('\tInvalid amount for spender:', addr, err.message);
            errorCount++;
            return;
          }
          totalAmount = totalAmount.add(amount);
          uniqueAddrs.set(addr.toLocaleLowerCase(), amount);
        };

        if (!files) {
          files = findSeparator(args[0]) < 0;
        }

        console.log('\nParsing\n');
        if (files) {
          let fileNo = 0;
          for (const fileName of args) {
            const fs = createReadStream(fileName);
            fileNo++;
            try {
              const reader = createInterface({ input: fs, crlfDelay: Infinity });
              let lineNo = 0;
              for await (const line of reader) {
                lineNo++;
                const s = line.trim();
                if (s !== '') {
                  console.log(`${fileNo} / ${args.length} / ${lineNo}`);
                  parseEntry(s);
                }
              }
            } finally {
              fs.close();
            }
          }
        } else {
          let lineNo = 0;
          for await (const line of args) {
            lineNo++;
            const s = line.trim();
            if (s !== '') {
              console.log(`0 / 0 / ${lineNo}`);
              parseEntry(s);
            }
          }
        }
        console.log('\nParsed', uniqueAddrs.size, 'entries,', errorCount, 'error(s)');

        if (errorCount > 0) {
          throw 'Parsing errors';
        }

        if (limit != undefined && totalAmount.gt(oneEther.multipliedBy(limit!).toFixed())) {
          throw 'Total value exceeds limit: ' + formatEther(totalAmount) + ' > ' + limit;
        } else {
          console.log('Total value:', formatEther(totalAmount));
        }

        let deadline = 0;
        {
          const date = new Date(deadlineStr);
          console.log('Claims will expire on:', date, date.getTime());
          deadline = (date.getTime() / 1000) | 0;
        }

        const writeOutput = async (out: Console, fileOut: boolean) => {
          if (!encode) {
            out.log('[');
          }
          let lineNo = 0;
          for (const [spender, value] of uniqueAddrs) {
            lineNo++;
            const params = buildRewardClaimPermitParams(domainParams, {
              provider: signer.address,
              spender: spender,
              value: value.toString(),
              nonce: (await pool.nonces(spender)).toString(),
              deadline: deadline,
            });
            if (fileOut) {
              console.log('Out:', lineNo, '/', uniqueAddrs.size);
            }

            const signature = await signer._signTypedData(params.domain, params.types, params.message!);
            const { v, r, s } = splitSignature(signature);

            const { nonce, ...woNonce } = params.message!;
            const p = { ...woNonce, v, r, s };

            if (encode) {
              const encoded = pool.interface.encodeFunctionData('claimRewardByPermit', [
                p.provider,
                p.spender,
                p.value,
                p.deadline,
                p.v,
                p.r,
                p.s,
              ]);
              out.log(`${spender}: ${encoded};`);
            } else {
              out.log(p, ',');
            }
          }
          if (!encode) {
            out.log(']');
          }
        };

        if (outFile === undefined) {
          console.log('\n=========================================================');
          await writeOutput(console, false);
        } else {
          const ws = createWriteStream(outFile);
          const writeAndClose = async () => {
            await writeOutput(new console.Console(ws), true);
            ws.end();

            return new Promise(function (resolve, reject) {
              ws.once('error', reject);
              ws.once('finish', resolve);
            });
          };
          await writeAndClose();
        }

        console.log('\n=========================================================');
        console.log('Total count:', uniqueAddrs.size);
        console.log('Total value:', formatEther(totalAmount), totalAmount.toString());
        console.log('Reward pool:', poolName, poolAddr);
        console.log('Provider address:', signer.address);
      } catch (error) {
        console.error(error);
        exit(1);
      }
    }
  );

const createWallet = (sk: string) => {
  if (sk == '') {
    return Wallet.createRandom();
  }

  if (isHexPrefixed(sk)) {
    return new Wallet(sk);
  }
  return Wallet.fromMnemonic(sk);
};

const unquote = (s: string): string => {
  var quote = s[0];
  var single = quote === "'";
  return s
    .substring(1, s.length - 1)
    .replace(/\\\\/g, '\\')
    .replace(single ? /\\'/g : /\\"/g, quote);
};
