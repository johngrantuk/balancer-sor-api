const dotenv = require("dotenv");
import { SOR, SwapTypes, bnum, SwapInfo } from "@balancer-labs/sor2";
import BigNumber from "bignumber.js";
import debug from "debug";
import { JsonRpcProvider } from '@ethersproject/providers';
import express from "express";
import { Network, Order } from "./types";
import { 
  getDecimals, 
  getSymbol, 
  orderKindToSwapType 
} from "./utils";

const log = debug("balancer");
dotenv.config();

const { PORT, MAX_POOLS, INFURA_PROJECT_ID } =
  process.env;

const nodeUrl = `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`;
const poolsSource = 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2';
const chainId = Network.MAINNET;
const gasPrice = new BigNumber('30000000000');
let maxPools: number = 4;
if (MAX_POOLS)
  maxPools = Number(MAX_POOLS);

const port = PORT || 3000;

log(`connecting to node ${nodeUrl}`);
const provider: any = new JsonRpcProvider(nodeUrl);

const sor = new SOR(
  provider,
  gasPrice,
  maxPools,
  chainId,
  poolsSource
);

// Stores cache of token symbol and decimals
const tokenInfoCache = new Map();
let lastBlockNumber = 0;

// Updates SOR token cost if not previously set or if gasPrice has changed
async function handleTokenCost(sor: SOR, swapType: SwapTypes, tokenIn: string, tokenOut: string, gasPrice: string): Promise<boolean>{
  let isUpdated = false;

  let currentCost = sor.tokenCost[tokenOut];

  if (swapType === SwapTypes.SwapExactOut)
    currentCost = sor.tokenCost[tokenIn];

  // Only set cost if not previously set or if gasPrice has changed
  if (gasPrice !== sor.gasPrice.toString() || currentCost === undefined) {
    isUpdated = true;
    sor.gasPrice = bnum(gasPrice);

    // This calculates the cost to make a swap which is used as an input to sor to allow it to make gas efficient recommendations.
    // Can be set once and will be used for further swap calculations.
    // Defaults to 0 if not called or can be set manually using: await sor.setCostOutputToken(tokenOut, manualPriceBn)
    if (swapType === SwapTypes.SwapExactIn)
      await sor.setCostOutputToken(tokenOut, await getDecimals(provider, tokenOut, tokenInfoCache));
    else
      await sor.setCostOutputToken(tokenIn, await getDecimals(provider, tokenIn, tokenInfoCache));

  }
  return isUpdated;
}

async function getSorSwap(order: Order): Promise<SwapInfo> {
  log(`Getting swap: ${JSON.stringify(order)}`);
  const { sellToken, buyToken, orderKind, amount, gasPrice } = order;

  const tokenIn = sellToken;
  const tokenOut = buyToken;
  const swapType = orderKindToSwapType(orderKind);

  const currentBlockNo = await provider.getBlockNumber();

  if(currentBlockNo !== lastBlockNumber){
    log(`fetching onChain pool info ${lastBlockNumber} ${currentBlockNo}`)
    // Fetch pool data with essential onchain information
    await sor.fetchPools(true);
    lastBlockNumber = currentBlockNo;
  }

  // Will update token cost if not already up to date
  const updatedCost = await handleTokenCost(sor, swapType, tokenIn, tokenOut, gasPrice);
  if(updatedCost)
    log(`updated token cost`);

  const amountUnits = new BigNumber(amount).dividedBy(
    new BigNumber(10).pow(
      await getDecimals(provider, orderKind === "sell" ? sellToken : buyToken, tokenInfoCache)
    )
  );

  log(
    `${orderKind}ing ${amountUnits} ${await getSymbol(provider, sellToken, tokenInfoCache)}` +
      ` for ${await getSymbol(provider, buyToken, tokenInfoCache)}`
  );
  log(orderKind);
  log(`Token In: ${tokenIn}`);
  log(`Token In: ${tokenOut}`);
  log(`Amount: ${amountUnits.toString()}`);
  const swapInfo = await sor.getSwaps(
    sellToken,
    buyToken,
    orderKindToSwapType(orderKind),
    amountUnits
  );

  log(`SwapInfo: ${JSON.stringify(swapInfo)}`);
  log(swapInfo.swaps);
  log(swapInfo.tokenAddresses);
  log(swapInfo.returnAmount.toString());
  return swapInfo;
}

const app = express();

app.post("/", express.json(), async (req, res, next) => {
  try{
    const swapInfo = await getSorSwap(req.body);
    res.json(swapInfo);
      // .then((solution) => res.json(solution))
      // .catch(next);
  } catch(error){
    log(`Error: ${error.message}`);
    return next(error);
  }
});

app.listen(PORT, () => {
  log(`Server listening at http://localhost:${PORT}`);
});
