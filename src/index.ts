import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { MongoClient } from 'mongodb'
//
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json()) // required for POST JSON bodies

// ----------------- MONGO CLIENT -----------------
let mongo_client = new MongoClient("mongodb+srv://MongoDB:r7jBEW8yIWqcLZp3@cluster0.m96ya.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
await mongo_client.connect()


async function getMongoClient() {
  if (!mongo_client) {
    mongo_client = new MongoClient("mongodb+srv://MongoDB:r7jBEW8yIWqcLZp3@cluster0.m96ya.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0");
    await mongo_client.connect();
  }
  return mongo_client;
}
console.log("Connected to MongoDB")

// ----------------- HOME ROUTE -----------------
app.get('/', (req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>Express on Vercel</title>
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/api-data">API Data</a>
          <a href="/healthz">Health</a>
          <a href="/update-item-test">Update Item (POST)</a>
        </nav>
        <h1>Welcome to Express on Vercel 🚀</h1>
        <p>This is a minimal example without a database or forms.</p>
        <img src="/logo.png" alt="Logo" width="120" />
      </body>
    </html>
  `)
})

// ----------------- ABOUT ROUTE -----------------
app.get('/about', function (req, res) {
  res.sendFile(path.join(__dirname, '..', 'components', 'about.htm'))
})

// ----------------- API DATA -----------------
app.get('/api-data', (req, res) => {
  res.json({
    message: 'Here is some sample API data',
    items: ['apple', 'banana', 'cherry'],
  })
})

// ----------------- HEALTH CHECK -----------------
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ----------------- TEST PAGE FOR POST ROUTE -----------------
app.get("/update-item-test", (req, res) => {
  res.type("html").send(`
    <h1>POST /update-item</h1>
    <p>Use curl or Postman:</p>
    <pre>
curl -X POST https://your-domain/update-item \\
  -H "Content-Type: application/json" \\
  -d '{ 
        "filter": { "itemId": 123 }, 
        "update": { 
          "$inc": { "quantitySold": 1 },
          "$push": { "serials": { "u": "test-user" } }
        }
      }'
    </pre>
  `)
})

app.post('/insert-item', async (req, res) => {
    const client = getMongoClient();

   const {
        itemId,
        originalPrice,
        totalQuantity,
        creator,
        name,
        description
    } = req.body;

    if (!itemId || !originalPrice || !totalQuantity || !creator || !name || description === undefined) {
        return res.status(400).json({
            error: "Missing required fields: itemId, originalPrice, totalQuantity, creator, name, description"
        });
    }
    const itemData = {
        name,
        description,
        itemId,
        type: "unique",
        originalPrice,
        totalQuantity,
        tradeable: true,
        creator,
        quantitySold: 0,
        rap: 0,
        value: 0,
        serials: [],
        reselling: {},
        history: {
            rap: [],
            sales: [],
            price: []
        },
        releaseTime: Math.floor(Date.now() / 1000),
        offsaleTime: 0
    };
  
    try {
        const db = client.db("cool");
        const items = db.collection("cp");

        const result = await items.insertOne(itemData);
        const insertedItem = await items.findOne({ _id: result.insertedId });
        const allItems = await items.find({}).toArray();

        res.status(200).json({
            message: "Item inserted successfully",
            insertedId: result.insertedId,
            insertedItem,
            allItems
        });

    } catch (err) {
        console.error("MongoDB error:", err);
        res.status(500).json({ error: "MongoDB error", details: err.message });
    } finally {
        await client.close();
    }
});


// ======================================================================
//                🔥  NEW ROUTE USING YOUR SCRIPT 2 LOGIC 🔥
// ======================================================================
app.post("/UpdateOne", async (req, res) => {
  try {
    if (!mongo_client) {
      return res.status(500).json({ status: "error", message: "MongoDB client not initialized" });
    }

    console.log("REQ BODY:", JSON.stringify(req.body, null, 2));


    const collection = mongo_client.db("cool").collection("cp");

    const filter = req.body.filter;
    const update = req.body.update;

    if (!filter || typeof filter !== "object" || !update || typeof update !== "object") {
      return res.status(400).json({
        status: "error",
        message: "Missing or invalid `update` or `filter` in JSON body",
      });
    }

    const doc = await collection.findOne(filter);
if (doc) {
  if (!Array.isArray(doc.history) && doc.history) {
    await collection.updateOne(filter, { $set: { history: [doc.history] } });
  }
  if (!Array.isArray(doc.serials) && doc.serials) {
    await collection.updateOne(filter, { $set: { serials: [doc.serials] } });
  }
}
    

    // --- 2. Logging special event if quantitySold is incremented ---
    try {
      const quantityInc = update["$inc"]?.quantitySold;
      const serialsPush = update["$push"]?.serials;
      if (quantityInc === 1 && serialsPush?.u) {
        console.log(`User_${serialsPush.u} bought Item_${filter.itemId}!`);
      }
    } catch (err) {
      console.error("Logging error:", err);
    }

    // --- 3. Perform the update safely ---

    console.log("FILTER:", JSON.stringify(filter, null, 2));
console.log("UPDATE:", JSON.stringify(update, null, 2));

    const result = await collection.findOneAndUpdate(filter, update, {
      returnDocument: "after", // MongoDB Node.js driver v4+
    });

    if (!result.value) {
  await collection.updateOne(filter, update);
  const docAfter = await collection.findOne(filter);
  return res.status(200).json({
    status: "success",
    message: "Update successful (fallback)",
    data: docAfter,
  });
}

    return res.status(200).json({
      status: "success",
      message: "Update successful",
      data: result,
    });

  } catch (error) {
    console.error("Internal Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
      error: error.message, // optional: include the exact MongoDB error for debugging
    });
  }
});


app.post("/UpdateBulk", async (req, res) => {
  try {
    const client = await getMongoClient();
    const collection = client.db("cool").collection("cp");

    const bulkOps = [];
    const updates = req.body.updates;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        status: "error",
        message: "Missing or invalid `updates` array in the request body",
      });
    }

    updates.forEach((updateObj) => {
      const filter = updateObj.filter;
      const update = updateObj.update;

      if (!filter || !update) return;

      bulkOps.push({
        updateOne: {
          filter,
          update,
          upsert: false,
        },
      });
    });

    if (bulkOps.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No valid updates found in the request",
      });
    }

    const result = await collection.bulkWrite(bulkOps, { ordered: false });

    const updatedDocumentsCount = result.modifiedCount;
    const upsertedDocumentsCount = result.upsertedCount;

    return res.status(200).json({
      status: "success",
      message: "Bulk update successful",
      updatedDocumentsCount,
      upsertedDocumentsCount,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
});

app.get("/GetInventory", async (req, res) => {
  const sendResponse = (statusCode: number, content: any) => {
    res.status(statusCode).json(content);
  };

  try {
    const { id: userId } = req.query;
    if (!userId || isNaN(Number(userId))) {
      return sendResponse(400, {
        status: "error",
        message: "Invalid User ID",
      });
    }

    const client = await getMongoClient();
    const database = client.db("cool");

    await checkIfEligibleForStarterItems(database, parseInt(userId as string));
    const items = await getItems(database, userId as string);
    const gamepasses = await getGamePasses(database, userId as string);

    sendResponse(200, {
      success: true,
      data: formatInventory(items, userId as string),
      gamepasses,
    });
  } catch (error) {
    console.error(error);
    sendResponse(500, { status: "error", message: "Internal Server Error" });
  }
});

// -----------------------------
// Supporting functions for inventory
// -----------------------------
async function getItems(database: any, userId: string) {
  const collection = database.collection("cp");
  return collection
    .find(
      { "serials.u": parseInt(userId) },
      { projection: { "serials.u": 1, "serials._id": 1, itemId: 1 } }
    )
    .toArray();
}

async function getGamePasses(database: any, userId: string) {
  const collection = database.collection("gifted_gamepasses");
  const doc = (await collection.findOne({ user_id: parseInt(userId) })) || {};
  return doc.gamepasses || [];
}

function formatInventory(items: any[], userId: string) {
  const inventory: Record<string, string[]> = {};
  items.forEach((item) => {
    const userSerials = item.serials
      .map((serial: any, index: number) =>
        serial && serial.u === parseInt(userId) ? String(index + 1) : null
      )
      .filter((serial) => serial !== null);

    if (userSerials.length > 0) {
      inventory[item.itemId] = inventory[item.itemId] || [];
      inventory[item.itemId].push(...userSerials);
    }
  });
  return inventory;
}

async function checkIfEligibleForStarterItems(database: any, userId: number) {
  const collection = database.collection("user_analytics");
  let user = await collection.findOne({ userId });

  if (!user) {
    await collection.insertOne({ userId, claimedStarterItems: false });
    user = { claimedStarterItems: false };
  }

  if (user.claimedStarterItems) return;

  const items_collection = database.collection("cp");
  const starterItem = await items_collection.findOne(
    { tag: "starter" },
    { projection: { itemId: 1 } }
  );
  if (!starterItem) return;

  await items_collection.updateOne(
    { itemId: starterItem.itemId },
    {
      $push: { serials: { u: userId, t: Math.floor(Date.now() / 1000) } },
      $inc: { totalQuantity: 1, quantitySold: 1 },
    }
  );

  await collection.updateOne(
    { userId },
    { $set: { claimedStarterItems: true } }
  );
}


app.get("/GetInventoryBulk", async (req, res) => {
  try {
    let UserIds = req.query.ids as string;

    if (!UserIds) {
      return res.status(400).json({
        status: "error",
        message: "Invalid User IDs",
      });
    }

    // Split by '-' and convert to numbers
    let userIdArray = UserIds.split("-").map(Number);

    if (userIdArray.some(isNaN)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid User IDs",
      });
    }

    const client = await getMongoClient();
    const db = client.db("cool");
    const itemsCollection = db.collection("cp");

    const docs = await itemsCollection
      .find(
        { "serials.u": { $in: userIdArray } },
        { projection: { "serials.u": 1, "serials._id": 1, itemId: 1 } }
      )
      .toArray();

    const data: Record<number, string[]> = {};

    docs.forEach((item) => {
      item.serials.forEach((serial_info: any, index: number) => {
        if (serial_info && userIdArray.includes(serial_info.u)) {
          const user_id = serial_info.u;
          if (!data[user_id]) {
            data[user_id] = [];
          }
          data[user_id].push(`${item.itemId}-${index + 1}`);
        }
      });
    });

    res.status(200).json({
      status: "success",
      data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
});

app.get("/GetItem", async (req, res) => {
  try {
    const client = await getMongoClient();
    const collection = client.db("cool").collection("cp");

    // Copy query filters
    const filter: any = { ...req.query };

    if (filter.itemId) {
      filter.itemId = parseInt(filter.itemId as string);
    }

    // MongoDB aggregation pipeline
    const cursor = collection.aggregate([
      { $match: filter },
      {
        $project: {
          _id: 0,
          serials: 1,
          itemId: 1,
          name: 1,
          creator: 1,
          description: 1,
          type: 1,
          originalPrice: 1,
          releaseTime: 1,
          rap: 1,
          quantitySold: 1,
          history: 1,
          reselling: 1,
          tradeable: 1,
          offsaleTime: 1,
          value: 1,
          projected: 1,
          totalQuantity: 1,
        },
      },
      {
        $project: {
          "serials.h": 0, // hide history inside serials
        },
      },
    ]);

    const items = await cursor.toArray();

    res.status(200).json({
      status: "success",
      data: items,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});



// ======================================================================
//                      EXPORT APP FOR VERCEL
// ======================================================================
export default app

