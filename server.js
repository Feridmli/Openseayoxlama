// server.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { nanoid } from "nanoid";
import postgres from "postgres";
import path from "path";
import { fileURLToPath } from "url";

const POSTGRES_URL = process.env.POSTGRES_URL || "postgresql://postgres:kamoazmiu123@db.wxyojhjoqosltdpmhqwb.supabase.co:5432/postgres";
const sql = postgres(POSTGRES_URL, { ssl: { rejectUnauthorized: false } });

const app = express();
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: "*" }));

const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NFT_CONTRACT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS || "0x54a88333F6e7540eA982261301309048aC431eD5";
const PROXY_CONTRACT_ADDRESS = process.env.PROXY_CONTRACT_ADDRESS || "0x9656448941C76B79A39BC4ad68f6fb9F01181EC7";

/* Serve static build */
app.use(express.static(path.join(__dirname, "dist")));

/* Basic health */
app.get("/health", (req, res) => res.json({ ok: true }));

/* POST /order -> create order record (sənin seaport order JSON-ını backend-ə yaza bilərsən) */
app.post("/order", async (req, res) => {
  try {
    const { tokenId, price, sellerAddress, seaportOrder, orderHash, image } = req.body;
    if (!tokenId || !price || !sellerAddress || !seaportOrder) {
      return res.status(400).json({ success: false, error: "Missing parameters" });
    }

    const id = nanoid();
    const createdAt = new Date().toISOString();

    await sql`
      INSERT INTO orders (id, tokenId, price, nftContract, marketplaceContract, seller, seaportOrder, orderHash, image, onChain, createdAt)
      VALUES (${id}, ${tokenId.toString()}, ${price.toString()}, ${NFT_CONTRACT_ADDRESS}, ${PROXY_CONTRACT_ADDRESS}, ${sellerAddress.toLowerCase()}, ${JSON.stringify(seaportOrder)}, ${orderHash || null}, ${image || null}, ${!!orderHash}, ${createdAt})
    `;
    res.json({ success: true, order: { id, tokenId, price, seller: sellerAddress, createdAt } });
  } catch (e) {
    console.error("POST /order error", e);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/* GET /orders?page=1&limit=12 - paginate */
app.get("/orders", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, parseInt(req.query.limit || "12", 10));
    const offset = (page - 1) * limit;

    const rows = await sql`
      SELECT id, tokenId, price, seller, seaportOrder, image, createdAt
      FROM orders
      ORDER BY "createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    // postgres module returns array of rows
    res.json({ success: true, orders: rows });
  } catch (e) {
    console.error("GET /orders error", e);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/* GET /orders/:id - single order */
app.get("/orders/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const rows = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, order: rows[0] });
  } catch (e) {
    console.error("GET /orders/:id error", e);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/* Fallback to index.html for client-side routing */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

/* Start */
app.listen(PORT, () => console.log(`🚀 Backend listening on port ${PORT}`));