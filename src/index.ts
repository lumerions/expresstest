
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { MongoClient } from 'mongodb'
import axios from 'axios'
import crypto from 'crypto'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import Noblox from "noblox.js";
const { getGamePassProductInfo, getUsernameFromId, getThumbnails } = Noblox;
const defaultMongoUri = "mongodb+srv://MongoDB:r7jBEW8yIWqcLZp3@cluster0.m96ya.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
const app = express()
app.use(express.json()) 

const clients = {};

async function getMongoClient(uri: string) {
  if (!clients[uri]) {
    const client = new MongoClient(uri);
    await client.connect();
    clients[uri] = client;
  }
  return clients[uri];
}


app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.post("/update-value", async (req, res) => {
    const token = req.headers["x-api-key"];
  console.log(token)
   let uri = ""
    if (token === "GameSell") { 
        uri = "mongodb+srv://gamblesite_db_user:pYEApJnYBLMz3DGP@gamblesite.ttpjfpf.mongodb.net/gamblesite?retryWrites=true&w=majority&appName=gamblesite"
    }
    if (token === "CooleedD") { 
        uri = defaultMongoUri
    }
    const client = await getMongoClient(uri); 

    const { itemId, value } = req.body;

    if (!itemId || value === undefined) {
        return res.status(400).json({
            error: "Missing required fields: itemId, value"
        });
    }

    try {
        const db = client.db("cool");
        const items = db.collection("cp");

        const updateResult = await items.updateOne(
            { itemId: itemId },
            { $set: { value: value } }
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({
                error: "Item not found",
                itemId
            });
        }

        const updatedItem = await items.findOne({ itemId: itemId });

        res.status(200).json({
            message: "Item value updated successfully",
            updatedItem
        });

    } catch (err: any) {
        console.error("MongoDB error:", err);
        res.status(500).json({
            error: "MongoDB error",
            details: err.message
        });
    }
});


app.post('/insert-item', async (req, res) => {
    const token = req.headers["x-api-key"];

   let uri = ""
    if (token === "GameSell") { 
        uri = "mongodb+srv://gamblesite_db_user:pYEApJnYBLMz3DGP@gamblesite.ttpjfpf.mongodb.net/gamblesite?retryWrites=true&w=majority&appName=gamblesite"
    }
    if (token === "CooleedD") { 
        uri = defaultMongoUri
    }
    const client = await getMongoClient(uri);

   let {
        itemId,
        originalPrice,
        totalQuantity,
        creator,
        name,
        description
    } = req.body;

   itemId = Number(itemId);
    originalPrice = Number(originalPrice);
    totalQuantity = Number(totalQuantity);

    if (
        isNaN(itemId) ||
        isNaN(originalPrice) ||
        isNaN(totalQuantity) ||
        !creator ||
        !name ||
        description === undefined
    ) {
        return res.status(400).json({
            error: "Invalid or missing fields"
        });
    }

      const itemData = {
    itemId: Number(itemId),
    name,
    description,
    type: "unique",
    originalPrice: Number(originalPrice),
    totalQuantity: Number(totalQuantity),
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

        res.status(200).json({
            message: "Item inserted successfully",
            insertedId: result.insertedId,
            insertedItem
        });

    } catch (err) {
        console.error("MongoDB error:", err);
        res.status(500).json({ error: "MongoDB error", details: err.message });
    } finally {
        console.log('done')
    }
});

app.post("/UpdateOne", async (req, res) => {
  const token = req.headers["x-api-key"];

  let uri = "";

  if (token === "GameSell") {
    uri = defaultMongoUri;
  }

  if (token === "CooleedD") {
    uri = "mongodb+srv://gamblesite_db_user:pYEApJnYBLMz3DGP@gamblesite.ttpjfpf.mongodb.net/gamblesite?retryWrites=true&w=majority&appName=gamblesite";
  }

  if (!uri) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  const client = await getMongoClient(uri);;

  try {
    if (!client) {
      return res.status(500).json({ status: "error", message: "MongoDB client not initialized" });
    }

    console.log("REQ BODY:", JSON.stringify(req.body, null, 2));


    const collection = client.db("cool").collection("cp");

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
        

    try {
      const quantityInc = update["$inc"]?.quantitySold;
      const serialsPush = update["$push"]?.serials;
      if (quantityInc === 1 && serialsPush?.u) {
        console.log(`User_${serialsPush.u} bought Item_${filter.itemId}!`);
      }
    } catch (err) {
      console.error("Logging error:", err);
    }

    console.log("FILTER:", JSON.stringify(filter, null, 2));
console.log("UPDATE:", JSON.stringify(update, null, 2));

    const result = await collection.findOneAndUpdate(
      filter,
      update,
      { returnDocument: "after", upsert: true }
    );

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
      error: error.message, 
    });
  }
});


app.post("/UpdateBulk", async (req, res) => {
  try {

    const token = req.headers["x-api-key"];
   let uri = ""
    if (token === "GameSell") { 
        uri = "mongodb+srv://gamblesite_db_user:pYEApJnYBLMz3DGP@gamblesite.ttpjfpf.mongodb.net/gamblesite?retryWrites=true&w=majority&appName=gamblesite"
    }
    if (token === "CooleedD") { 
        uri = defaultMongoUri
    }
    const client = await getMongoClient(uri);
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
  console.log("HEADERS:", req.headers);
console.log("TOKEN RAW:", token);
console.log("TOKEN TYPE:", typeof token);
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

    const token = req.headers["x-api-key"];
   let uri = ""
    if (token === "GameSell") { 
        uri = "mongodb+srv://gamblesite_db_user:pYEApJnYBLMz3DGP@gamblesite.ttpjfpf.mongodb.net/gamblesite?retryWrites=true&w=majority&appName=gamblesite"
    }
    if (token === "CooleedD") { 
        uri = defaultMongoUri
    }
    const client = await getMongoClient(uri);
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

    let userIdArray = UserIds.split("-").map(Number);

    if (userIdArray.some(isNaN)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid User IDs",
      });
    }

    const token = req.headers["x-api-key"];
   let uri = ""
    if (token === "GameSell") { 
        uri = "mongodb+srv://gamblesite_db_user:pYEApJnYBLMz3DGP@gamblesite.ttpjfpf.mongodb.net/gamblesite?retryWrites=true&w=majority&appName=gamblesite"
    }
    if (token === "CooleedD") { 
        uri = defaultMongoUri
    }

    const client = await getMongoClient(uri);
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
    const token = req.headers["x-api-key"];
   let uri = ""
    if (token === "GameSell") { 
        uri = "mongodb+srv://gamblesite_db_user:pYEApJnYBLMz3DGP@gamblesite.ttpjfpf.mongodb.net/gamblesite?retryWrites=true&w=majority&appName=gamblesite"
    }
    if (token === "CooleedD") { 
        uri = defaultMongoUri
    }
    const client = await getMongoClient(uri);
    const collection = client.db("cool").collection("cp");

    const filter: any = { ...req.query };

    if (filter.itemId) {
      filter.itemId = parseInt(filter.itemId as string);
    }

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
          "serials.h": 0, 
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

function validateInput(req) {
  const { user_id, item } = req.body;
  if (!user_id || !item) {
    throw new Error("Invalid Input");
  }
}

app.delete("/unlist", async (req, res) => {
  try {
    console.log(req.body);
    validateInput(req);

    let { user_id, item } = req.body;
    let [itemid, serial] = item;

    itemid = parseInt(itemid);
    serial = parseInt(serial) - 1;

    const token = req.headers["x-api-key"];
   let uri = ""
    if (token === "GameSell") { 
        uri = "mongodb+srv://gamblesite_db_user:pYEApJnYBLMz3DGP@gamblesite.ttpjfpf.mongodb.net/gamblesite?retryWrites=true&w=majority&appName=gamblesite"
    }
    if (token === "CooleedD") { 
        uri = defaultMongoUri
    }

    const client = await getMongoClient(uri);
    const robux_market = client
      .db("cool")
      .collection("robuxmarket");

    const listed_doc = await robux_market.findOne({
      userId: user_id,
      itemId: itemid,
      serial,
    });

    if (!listed_doc) {
      return res.status(400).json({
        status: "error",
        error: "Item not listed",
      });
    }

    if (listed_doc._PROCESSING) {
      return res.status(400).json({
        status: "error",
        error: "Item is processing",
      });
    }

    await robux_market.deleteOne({
      userId: user_id,
      itemId: itemid,
      serial,
    });

    return res.json({
      status: "success",
      message: "Item unlisted successfully",
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "error",
      error: error.message,
    });
  }
});

async function getRobuxMarket(client) {
  return client.db("cool").collection("robuxmarket");
}

async function getItemss(client) {
  return client.db("cool").collection("cp");
}

async function getSettings(client) {
  return client.db("cool").collection("game_settings");
}

app.post("/list", async (req, res) => {
  try {
    validateInput(req);

    let { user_id, item, gamepass_id } = req.body;
    let [itemid, serial] = item;

    itemid = parseInt(itemid);
    serial = parseInt(serial) - 1;

    const token = req.headers["x-api-key"];
   let uri = ""
    if (token === "GameSell") { 
        uri = "mongodb+srv://gamblesite_db_user:pYEApJnYBLMz3DGP@gamblesite.ttpjfpf.mongodb.net/gamblesite?retryWrites=true&w=majority&appName=gamblesite"
    }
    if (token === "CooleedD") { 
        uri = defaultMongoUri
    }
    const client = await getMongoClient(uri);

    const robux_market = await getRobuxMarket(client);
    const items = await getItemss(client);
    const settings = await getSettings(client);

    const settings_doc = await settings.findOne({
      tag: "global_settings",
    });

    const listed_doc = await robux_market.findOne({
      itemId: itemid,
      serial,
    });

    if (listed_doc) {
      return res.status(400).json({
        status: "error",
        error: "Item already listed",
      });
    }

    const listed_count = await robux_market.countDocuments({
      userId: user_id,
    });

    const maxListings = settings_doc?.robux_market_max || 10;

    if (listed_count >= maxListings) {
      return res.status(400).json({
        status: "error",
        error: `You can only list ${maxListings} items at a time`,
      });
    }

    const item_doc = await items.findOne(
      { itemId: itemid },
      { projection: { "serials.h": 0, history: 0, reselling: 0 } }
    );

    if (!item_doc) {
      return res.status(400).json({
        status: "error",
        error: "Invalid Item",
      });
    }

    if (item_doc.tradeable !== true) {
      return res.status(400).json({
        status: "error",
        error: "Item not tradeable",
      });
    }

    const serial_info = item_doc.serials[serial];
    if (!serial_info || serial_info.u !== user_id) {
      return res.status(400).json({
        status: "error",
        error: "Invalid Item",
      });
    }

    const gamepass_info = await getGamePassProductInfo(gamepass_id);

    if (gamepass_info.Creator.Id !== user_id) {
      return res.status(400).json({
        status: "error",
        error: "Invalid Owner",
      });
    }

    const price = gamepass_info.PriceInRobux;
    if (!price) {
      return res.status(400).json({
        status: "error",
        error: "Invalid Gamepass",
      });
    }

    if (item_doc.value) {
      const valuePerRobux = (item_doc.value || item_doc.rap) / price;
      const ratePer10k = 10000 / valuePerRobux;
      const minimum_rate = settings_doc?.robux_market_rate || 0.2;

      if (ratePer10k < minimum_rate) {
        return res.status(400).json({
          status: "error",
          error: `Invalid Rate-${minimum_rate}`,
        });
      }
    }

    const insert_doc = {
      userId: user_id,
      itemId: itemid,
      serial,
      gamepassId: gamepass_id,
      price,
    };

    await robux_market.insertOne(insert_doc);

    return res.json({
      status: "success",
      data: insert_doc,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "error",
      error: error.message,
    });
  }
});

app.get("/get", async (req, res) => {
  try {
    const token = req.headers["x-api-key"];
   let uri = ""
    if (token === "GameSell") { 
        uri = "mongodb+srv://gamblesite_db_user:pYEApJnYBLMz3DGP@gamblesite.ttpjfpf.mongodb.net/gamblesite?retryWrites=true&w=majority&appName=gamblesite"
    }
    if (token === "CooleedD") { 
        uri = defaultMongoUri
    }
    const client = await getMongoClient(uri);
    const database = client.db("cool");
    const robux_market = database.collection("robuxmarket");

    const documents = await robux_market.find(
      { itemId: { $ne: "analytics" } },
      { projection: { _id: 0 } }
    ).toArray();

    documents.forEach(doc => {
      if (typeof doc.serial === "number") {
        doc.serial += 1;
      }
    });

    res.status(200).json({
      status: "success",
      data: documents
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
});


app.post("/buy", async (req, res) => {
  const { user_id, item, token, cancel } = req.body;
  let [itemid, serial] = item;

  itemid = parseInt(itemid);
  serial = parseInt(serial) - 1;

    const tokenn = req.headers["x-api-key"];
   let uri = ""
    if (tokenn === "GameSell") { 
        uri = "mongodb+srv://gamblesite_db_user:pYEApJnYBLMz3DGP@gamblesite.ttpjfpf.mongodb.net/gamblesite?retryWrites=true&w=majority&appName=gamblesite"
    }
    if (tokenn === "CooleedD") { 
        uri = defaultMongoUri
    }
  const client = await getMongoClient(uri);
  const database = await client.db("cool");
  const robux_market = await database.collection("robuxmarket");
  const items = await database.collection("cp");

  const unique_lock_field = `locks.${itemid}_${serial}`;

  try {
    const lockResult = await robux_market.findOneAndUpdate(
      { [unique_lock_field]: { $exists: false } },
      { $set: { [unique_lock_field]: { user_id, timestamp: Date.now() } } },
      { returnDocument: "after" }
    );

    if (!lockResult) {
      return res
        .status(400)
        .json({ status: "error", error: "Item already processing" });
    }

    const listed_doc = await robux_market.findOne({ itemId: itemid, serial });

    if (!listed_doc) {
      await robux_market.updateOne(
        { itemId: itemid, serial },
        { $unset: { [unique_lock_field]: "" } }
      );
      return res.status(400).json({ status: "error", error: "Item not listed" });
    }

    const item_doc = await items.findOne(
      { itemId: itemid },
      { projection: { "serials.h": 0, history: 0, reselling: 0 } }
    );
    if (!item_doc) {
      await robux_market.updateOne(
        { itemId: itemid, serial },
        { $unset: { [unique_lock_field]: "" } }
      );
      return res.status(400).json({ status: "error", error: "Invalid Item" });
    }

    const serial_info = item_doc.serials[serial];
    if (!serial_info || serial_info.u !== listed_doc.userId) {
      await robux_market.updateOne(
        { itemId: itemid, serial },
        { $unset: { [unique_lock_field]: "" } }
      );

      if (listed_doc) {
        await robux_market.deleteOne({ itemId: itemid, serial });
      }

      //log("1203327439883866163", {
      //  embeds: [
       //   {
       //     title: "Process Request Cancelled",
       //     description: `**Reason**: Item ownership changed\n**Item**: \`${itemid}-${serial + 1}\`\nBuyer: \`${user_id}\`\nSeller: \`${listed_doc.userId}\``,
        //    color: 16745728,
       //   },
      //  ],
     //});

      return res.status(400).json({ status: "error", error: "Item ownership changed" });
    }

    if (listed_doc.userId == user_id) {
      await robux_market.updateOne(
        { itemId: itemid, serial },
        { $unset: { [unique_lock_field]: "" } }
      );
      return res.status(400).json({ status: "error", error: "Cannot buy your own item" });
    }

    if (token) {
      if (listed_doc._PROCESSING !== token) {
        await robux_market.updateOne(
          { itemId: itemid, serial },
          { $unset: { [unique_lock_field]: "" } }
        );

      //  log("1203327439883866163", {
      //   content: `\n\`\`\`\n${JSON.stringify(listed_doc)}\n\`\`\``,
       //   embeds: [
       //     {
        //      title: "[CRITICAL] Process Request Cancelled",
        //      description: `**Reason**: Invalid token provided\n**Item**: \`${itemid}-${serial + 1}\`\nBuyer: \`${user_id}\`\nSeller: \`${listed_doc.userId}\`\nExpected Token: \`${listed_doc._PROCESSING}\`\nProvided Token: \`${token}\``,
         //     color: 16745728,
          //  },
          //],
      //  });

        return res.status(400).json({ status: "error", error: "Invalid token" });
      }

      if (cancel === true) {
        await robux_market.updateOne(
          { itemId: itemid, serial },
          { $unset: { _PROCESSING: "", [unique_lock_field]: "" } }
        );
        return res.status(200).json({ status: "success", data: "success" });
      }

      await items.updateOne(
        { itemId: itemid },
        {
          $set: {
            [`serials.${serial}.u`]: user_id,
            [`serials.${serial}.t`]: Math.floor(Date.now() / 1000),
          },
          $unset: {
            [`reselling.${serial}`]: "",
          },
          $push: {
            [`serials.${serial}.h`]: [
              "robux_market",
              listed_doc.userId,
              user_id,
              listed_doc.price,
              Date.now(),
            ],
          },
        }
      );

      await robux_market.updateOne(
        { itemId: "analytics" },
        { $inc: { total_sales: 1, total_robux: listed_doc.price, game_raised: listed_doc.price * 0.1 } },
        { upsert: true }
      );

      const user_analytics = await database.collection("user_analytics");
      await user_analytics.findOneAndUpdate(
        { userId: user_id },
        { $inc: { total_spent: listed_doc.price, game_raised: listed_doc.price * 0.1 } },
        { returnDocument: "after", upsert: true }
      );
      await user_analytics.findOneAndUpdate(
        { userId: listed_doc.userId },
        { $inc: { total_raised: listed_doc.price } },
        { returnDocument: "after", upsert: true }
      );

      await robux_market.deleteOne({ itemId: itemid, serial });

      res.status(200).json({ status: "success", data: "success" });
    } else {
      const processing_token = crypto.randomBytes(16).toString("hex");

      await robux_market.findOneAndUpdate(
        { itemId: itemid, serial },
        { $set: { _PROCESSING: processing_token, _PROCESSING_TIME: Date.now() } }
      );

      await robux_market.updateOne(
        { itemId: itemid, serial },
        { $unset: { [unique_lock_field]: "" } }
      );

      return res.status(200).json({ status: "success", data: processing_token });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "error", error: "Internal server error" });
  }
});



export default app




