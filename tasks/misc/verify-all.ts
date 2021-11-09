import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { verifyContractStringified, verifyProxy } from '../../helpers/contract-verification';
import {
  DbInstanceEntry,
  falsyOrZeroAddress,
  getExternalsFromJsonDb,
  getInstancesFromJsonDb,
  getVerifiedFromJsonDb,
  setVerifiedToJsonDb,
} from '../../helpers/misc-utils';

task('verify:verify-all-contracts', 'Use JsonDB to perform verification')
  .addFlag('force', 'Ignore verified status')
  .addOptionalParam('n', 'Batch index, 0 <= n < total number of batches', 0, types.int)
  .addOptionalParam('of', 'Total number of batches, > 0', 1, types.int)
  .addOptionalParam('proxy', 'Proxy verification mode: auto, full, min', 'auto', types.string)
  .addOptionalVariadicPositionalParam('filter', 'Names or addresses of contracts to verify', [], types.string)
  .setAction(async ({ n, of, filter, proxy, force }, DRE: HardhatRuntimeEnvironment) => {
    await DRE.run('set-DRE');

    if (n >= of) {
      throw 'invalid batch parameters';
    }

    let filterProxy: () => boolean;
    switch (proxy.toLowerCase()) {
      case 'auto':
        let hasFirst = false;
        filterProxy = () => {
          if (hasFirst) {
            return false;
          }
          hasFirst = true;
          return true;
        };
        break;
      case 'full':
        filterProxy = () => true;
        break;
      case 'min':
      default:
        filterProxy = () => false;
        break;
    }

    const filterSet = new Map<string, string>();
    (<string[]>filter).forEach((value) => {
      filterSet.set(value.toUpperCase(), value);
    });
    const hasFilter = filterSet.size > 0;

    const addrList: string[] = [];
    const entryList: DbInstanceEntry[] = [];
    let batchIndex = 0;

    const addEntry = (addr: string, entry: DbInstanceEntry) => {
      if (!entry.verify) {
        return;
      }

      if (hasFilter) {
        let found = false;
        for (const key of [addr, entry.id]) {
          const kv = key.toUpperCase();
          if (filterSet.has(kv)) {
            found = true;
            if (key == addr) {
              filterSet.delete(kv);
            }
            break;
          }
        }
        if (!found) {
          return;
        }
      }

      if (batchIndex++ % of != n) {
        return;
      }
      addrList.push(addr);
      entryList.push(entry);
    };

    for (const [key, entry] of getInstancesFromJsonDb()) {
      addEntry(key, entry);
    }

    for (const [key, entry] of getExternalsFromJsonDb()) {
      addEntry(key, entry);
    }

    for (const [key, value] of filterSet) {
      if (!falsyOrZeroAddress(value)) {
        addEntry(value, {
          id: 'ID_' + key,
          verify: {
            args: '[]',
          },
        });
      }
    }

    console.log('======================================================================');
    console.log('======================================================================');
    console.log(`Verification batch ${n} of ${of} with ${addrList.length} entries of ${batchIndex} total.`);
    console.log('======================================================================');

    const summary: string[] = [];
    for (let i = 0; i < addrList.length; i++) {
      const addr = addrList[i];
      const entry = entryList[i];

      const params = entry.verify!;

      console.log('\n======================================================================');
      console.log(`[${i}/${addrList.length}] Verify contract: ${entry.id} ${addr}`);
      console.log('\tArgs:', params.args);

      let fullVerify = true;
      if (params.impl) {
        console.log('\tProxy impl: ', params.impl);
        fullVerify = filterProxy();
      }

      if (!force && (await getVerifiedFromJsonDb(addr))) {
        console.log('Already verified');
        continue;
      }

      let [ok, err] = fullVerify ? await verifyContractStringified(addr, params.args!) : [true, ''];
      if (err) {
        console.log(err);
      }
      if (ok && params.impl) {
        [ok, err] = await verifyProxy(addr, params.impl!);
        if (err) {
          console.log(err);
        }
      }
      if (ok) {
        setVerifiedToJsonDb(addr, true);
      } else {
        summary.push(`${addr} ${entry.id}: ${err}`);
      }
    }

    console.log(`\n`);
    console.log('======================================================================');
    console.log(`Verification batch ${n} of ${of} has finished with ${summary.length} issue(s).`);
    console.log('======================================================================');
    console.log(summary.join('\n'));
    console.log('======================================================================');
  });
