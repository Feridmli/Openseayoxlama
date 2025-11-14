/**
 * syncOpenseaOrders.js — Gücləndirilmiş versiya 🚀
 * OpenSea → Backend NFT order sync
 * Node.js ≥18 (fetch daxili gəlir)
 */

// --- CONFIG ---
const BACKEND_URL = "https://sənin-app.onrender.com"; 
const NFT_CONTRACT_ADDRESS = "0x54a88333F6e7540eA982261301309048aC431eD5";
const PROXY_CONTRACT_ADDRESS = "0x9656448941C76B79A39BC4ad68f6fb9F01181EC7";
const PAGE_SIZE = 50;
const OPENSEA_API_KEY = "";

// Retry settings
const RETRY_LIMIT = 3;

// Duplicates marks
const SENT_ORDER_HASHES = new Set();

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// --- HELPERS ---
async function safeFetch(url, options = {}, attempt = 1) {
  try {
    const res = await fetch(url, options);

    if (res.status === 429) {
      if (attempt <= RETRY_LIMIT) {
        console.log(`⛔ Rate limit (429). Retry #${attempt} in ${attempt}s...`);
        await sleep(attempt * 1000);
        return safeFetch(url, options, attempt + 1);
      }
      console.log("❌ 429 after retries. Skipping.");
      return null;
    }

    if (!res.ok) {
      console.log(`❌ Fetch error ${res.status}: ${res.statusText}`);
      return null;
    }

    return res;
  } catch (err) {
    if (attempt <= RETRY_LIMIT) {
      console.log(`⚠ Network error. Retry #${attempt}...`, err.message);
      await sleep(attempt * 1000);
      return safeFetch(url, options, attempt + 1);
    }
    console.log("❌ Network failed after retries.");
    return null;
  }
}

async function fetchOpenseaAssets(offset = 0) {
  const url = `https://api.opensea.io/api/v1/assets?asset_contract_address=${NFT_CONTRACT_ADDRESS}&order_direction=desc&offset=${offset}&limit=${PAGE_SIZE}`;

  const headers = { "Accept": "application/json" };
  if (OPENSEA_API_KEY) headers["X-API-KEY"] = OPENSEA_API_KEY;

  const res = await safeFetch(url, { headers });
  if (!res) return [];

  try {
    const data = await res.json();
    return data.assets || [];
  } catch {
    console.log("❌ JSON parse error");
    return [];
  }
}

async function postOrderToBackend(order) {
  const res = await safeFetch(`${BACKEND_URL}/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order)
  });

  if (!res) return;

  try {
    const data = await res.json();
    if (!data.success) {
      console.log("⛔ Backend rejected:", data);
    } else {
      console.log(`✅ Saved token ${order.tokenId} (${order.price} ETH)`);
    }
  } catch {
    console.log("❌ Backend JSON error");
  }
}

// --- MAIN SYNC LOOP ---
async function main() {
  console.log("🚀 OpenSea Sync başladı...");
  let offset = 0;
  let totalNFT = 0;
  let totalOrders = 0;

  const startTime = Date.now();

  while (true) {
    console.log(`\n📦 Loading assets... offset=${offset}`);
    const batchStart = Date.now();

    const assets = await fetchOpenseaAssets(offset);
    if (!assets.length) {
      console.log("⏹ No more assets.");
      break;
    }

    for (const nft of assets) {
      totalNFT++;

      if (!nft.sell_orders || !nft.sell_orders.length) continue;

      for (const order of nft.sell_orders) {
        if (!order.protocol_data?.parameters) continue;

        // Duplicate check
        const hash = order.order_hash || `${nft.token_id}-${order.maker?.address}`;
        if (SENT_ORDER_HASHES.has(hash)) {
          console.log(`⏭ Skipped duplicate order ${hash}`);
          continue;
        }
        SENT_ORDER_HASHES.add(hash);

        const payload = {
          tokenId: nft.token_id,
          price: order.current_price ? parseFloat(order.current_price) / 1e18 : 0,
          sellerAddress: order.maker?.address || order.protocol_data.parameters.offerer || "unknown",
          seaportOrder: order.protocol_data,
          orderHash: hash,
          image: nft.image_url || nft.metadata?.image || null,
          marketplaceContract: PROXY_CONTRACT_ADDRESS
        };

        totalOrders++;
        await postOrderToBackend(payload);
      }
    }

    const batchTime = ((Date.now() - batchStart) / 1000).toFixed(1);
    console.log(`⏳ Batch completed in ${batchTime}s.`);

    offset += PAGE_SIZE;
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("\n🎉 SYNC FINISHED");
  console.log("📌 Total NFT scanned:", totalNFT);
  console.log("📌 Total orders sent:", totalOrders);
  console.log("⏱ Total time:", totalTime + "s");
}

// --- RUN ---
main().catch(err => {
  console.error("💀 FATAL ERROR:", err);
});