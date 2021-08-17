import { ethers } from "ethers";
import { Contract } from '@ethersproject/contracts';
import { SwapTypes } from "@balancer-labs/sor2";

async function getTokenInfo(provider, token: string, tokenInfoCache: Map<any, any>) {
    const normalizedToken = ethers.utils.getAddress(token);
    const cachedInfo = tokenInfoCache.get(normalizedToken);
    if (cachedInfo !== undefined) {
        return cachedInfo;
    }

    const contract = new Contract(
        token,
        [
            "function symbol() view returns (string)",
            "function decimals() view returns (uint8)",
        ],
        provider
    );
    const info = await Promise.all([
        contract
            .symbol()
            .catch(
                () => `${normalizedToken.substr(0, 4)}..${normalizedToken.substr(40)}`
            ),
        contract.decimals().then((d) => ethers.BigNumber.from(d).toNumber()),
    ]);
    tokenInfoCache.set(normalizedToken, info);

    return info;
}

export async function getSymbol(provider, token, tokenInfoCache) {
    const [symbol] = await getTokenInfo(provider, token, tokenInfoCache);
    return symbol;
}
export async function getDecimals(provider, token, tokenInfoCache) {
    const [, decimals] = await getTokenInfo(provider, token, tokenInfoCache);
    return decimals;
}

export function orderKindToSwapType(orderKind: string): SwapTypes {
    switch (orderKind) {
        case "sell":
            return SwapTypes.SwapExactIn;
        case "buy":
            return SwapTypes.SwapExactOut;
        default:
            throw new Error(`invalid order kind ${orderKind}`);
    }
}