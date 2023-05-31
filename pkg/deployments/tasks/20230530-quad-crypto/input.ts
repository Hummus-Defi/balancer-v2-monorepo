import Task, { TaskMode } from '../../src/task';

export type QuadCryptoDeployment = {
  Vault: string;
  WeightedPoolFactory: string;
  ProtocolFeePercentagesProvider: string;
  PoolVersion: string;
  WETH: string; // metis
  USDC: string;
  WBTC: string;
  ETH: string;
};

const Vault = new Task('20210418-vault', TaskMode.READ_ONLY);
const WeightedPoolFactory = new Task('20230320-weighted-pool-v4', TaskMode.READ_ONLY);
const ProtocolFeePercentagesProvider = new Task('20220725-protocol-fee-percentages-provider', TaskMode.READ_ONLY);
const WETH = new Task('00000000-tokens', TaskMode.READ_ONLY);
const USDC = new Task('00000000-tokens', TaskMode.READ_ONLY); 
const WBTC = new Task('00000000-tokens', TaskMode.READ_ONLY);
const ETH = new Task('00000000-tokens', TaskMode.READ_ONLY);

const BaseVersion = { version: 4, deployment: '20230320-weighted-pool-v4' };

export default {
  Vault,
  WeightedPoolFactory,
  ProtocolFeePercentagesProvider,
  PoolVersion: JSON.stringify({ name: 'WeightedPool', ...BaseVersion }),
  WETH,
  USDC,
  WBTC,
  ETH,
};