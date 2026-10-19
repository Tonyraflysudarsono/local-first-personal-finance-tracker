import { CRYPTO_SYMBOLS, CryptoCoinId, CryptoMarketQuote, CryptoMarketQuotes } from "./finance";

type CoinGeckoSimplePriceResponse = Partial<Record<CryptoCoinId, {
  usd?: unknown;
  idr?: unknown;
  last_updated_at?: unknown;
}>>;

export async function fetchCryptoMarketQuotes(coinIds: CryptoCoinId[], signal?: AbortSignal): Promise<CryptoMarketQuotes> {
  const uniqueCoinIds = [...new Set(coinIds)];
  if (uniqueCoinIds.length === 0) return {};
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${uniqueCoinIds.join(",")}&vs_currencies=usd,idr&include_last_updated_at=true`;
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Harga kripto belum dapat dimuat. Coba lagi beberapa saat.");
  const payload = await response.json() as CoinGeckoSimplePriceResponse;
  const quotes: CryptoMarketQuotes = {};

  for (const coinId of uniqueCoinIds) {
    const market = payload[coinId];
    const priceUsd = Number(market?.usd);
    const priceIdr = Number(market?.idr);
    const sourceTimestamp = Number(market?.last_updated_at);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0 || !Number.isFinite(priceIdr) || priceIdr <= 0) {
      throw new Error(`Harga ${CRYPTO_SYMBOLS[coinId]} dari sumber pasar tidak lengkap. Coba muat ulang.`);
    }
    quotes[coinId] = {
      coinId,
      symbol: CRYPTO_SYMBOLS[coinId],
      priceUsd,
      priceIdr,
      updatedAt: Number.isFinite(sourceTimestamp) && sourceTimestamp > 0
        ? new Date(sourceTimestamp * 1000).toISOString()
        : new Date().toISOString(),
      source: "CoinGecko",
    };
  }
  return quotes;
}

export async function fetchBitcoinMarketQuote(signal?: AbortSignal): Promise<CryptoMarketQuote> {
  const quote = (await fetchCryptoMarketQuotes(["bitcoin"], signal)).bitcoin;
  if (!quote) throw new Error("Harga BTC belum dapat dimuat. Coba lagi beberapa saat.");
  return quote;
}

export function getUsdIdrRate(quote: CryptoMarketQuote): number {
  return quote.priceIdr / quote.priceUsd;
}
