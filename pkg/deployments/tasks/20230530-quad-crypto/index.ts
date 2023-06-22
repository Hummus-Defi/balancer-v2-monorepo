import { getContractDeploymentTransactionHash, saveContractDeploymentTransactionHash } from '../../src/network';
import { ZERO_ADDRESS, ZERO_BYTES32 } from '@balancer-labs/v2-helpers/src/constants';
import Task from '../../src/task';
import { TaskRunOptions } from '../../src/types';
import { QuadCryptoDeployment } from './input';
import { bn, fp } from '@balancer-labs/v2-helpers/src/numbers';
import * as expectEvent from '@balancer-labs/v2-helpers/src/test/expectEvent';

export default async (task: Task, { force, from }: TaskRunOptions = {}): Promise<void> => {
  const input = task.input() as QuadCryptoDeployment;

  const factory = await task.instanceAt('WeightedPoolFactory', input.WeightedPoolFactory);

  // order rate providers by the alphabetic ordering of token addresses
  let rateProviders: string[] = [];
  if (task.network === 'metisGoerli') {
    rateProviders = [input.USDC_PROVIDER, input.BTC_PROVIDER, input.ETH_PROVIDER, input.METIS_PROVIDER];
  } else {
    rateProviders = [input.ETH_PROVIDER, input.BTC_PROVIDER, input.METIS_PROVIDER, input.USDC_PROVIDER];
  }

  // We also create a Pool using the factory and verify it, to let us compute their action IDs and so that future
  // Pools are automatically verified. We however don't run any of this code in CHECK mode, since we don't care about
  // the contracts deployed here. The action IDs will be checked to be correct via a different mechanism.
  const newWeightedPoolParams = {
    name: 'Quad Crypto',
    symbol: 'QUAD',
    tokens: [input.WETH, input.USDC, input.WBTC, input.ETH].sort(function (a, b) {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    }),
    normalizedWeights: [fp(0.25), fp(0.25), fp(0.25), fp(0.25)],
    rateProviders,
    assetManagers: [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS],
    swapFeePercentage: bn(1e15),
  };

  // The pauseWindowDuration and bufferPeriodDuration will be filled in later, but we need to declare them here to
  // appease the type system. Those are constructor arguments, but automatically provided by the factory.
  const poolArgs = {
    params: newWeightedPoolParams,
    vault: input.Vault,
    protocolFeeProvider: input.ProtocolFeePercentagesProvider,
    pauseWindowDuration: undefined,
    bufferPeriodDuration: undefined,
    owner: input.admin, // ZERO_ADDRESS,
    version: input.PoolVersion,
  };

  const poolCreationReceipt = await (
    await factory.create(
      poolArgs.params.name,
      poolArgs.params.symbol,
      poolArgs.params.tokens,
      poolArgs.params.normalizedWeights,
      poolArgs.params.rateProviders,
      poolArgs.params.swapFeePercentage,
      poolArgs.owner,
      ZERO_BYTES32
    )
  ).wait();
  const event = expectEvent.inReceipt(poolCreationReceipt, 'PoolCreated');
  const poolAddress = event.args.pool;

  await saveContractDeploymentTransactionHash(poolAddress, poolCreationReceipt.transactionHash, task.network);
  await task.save({ QuadCryptoPool: poolAddress });

  const pool = await task.instanceAt('WeightedPool', task.output()['QuadCryptoPool']);

  // In order to verify the Pool's code, we need to complete its constructor arguments by computing the factory
  // provided arguments (pause durations).

  // The durations require knowing when the Pool was created, so we look for the timestamp of its creation block.
  const txHash = await getContractDeploymentTransactionHash(pool.address, task.network);
  const tx = await ethers.provider.getTransactionReceipt(txHash);
  const poolCreationBlock = await ethers.provider.getBlock(tx.blockNumber);

  // With those and the period end times, we can compute the durations.
  const { pauseWindowEndTime, bufferPeriodEndTime } = await pool.getPausedState();
  poolArgs.pauseWindowDuration = pauseWindowEndTime.sub(poolCreationBlock.timestamp);
  poolArgs.bufferPeriodDuration = bufferPeriodEndTime
    .sub(poolCreationBlock.timestamp)
    .sub(poolArgs.pauseWindowDuration);

  // We are now ready to verify the Pool
  await task.verify('WeightedPool', pool.address, [
    poolArgs.params,
    poolArgs.vault,
    poolArgs.protocolFeeProvider,
    poolArgs.pauseWindowDuration,
    poolArgs.bufferPeriodDuration,
    poolArgs.owner,
    poolArgs.version,
  ]);
};
