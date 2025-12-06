import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { MongoClient } from 'mongodb'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json()) // required for POST JSON bodies

// ----------------- MONGO CLIENT -----------------
const mongo_client = new MongoClient(process.env.MONGODB_URI)
await mongo_client.connect()
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


// ======================================================================
//                🔥  NEW ROUTE USING YOUR SCRIPT 2 LOGIC 🔥
// ======================================================================
app.post("/update-item", async (req, res) => {
  let Processing = {}

  try {
    const collection = mongo_client.db("ArcadeHaven").collection("items")
    const filter = req.body.filter
    const update = req.body.update

    if (!filter || !update) {
      return res.status(400).json({
        status: "error",
        message: "Missing `update` or `filter` from JSON body",
      })
    }

    // Special console logging event
    try {
      if (update["$inc"] && update["$inc"].quantitySold === 1) {
        const item_id = filter.itemId
        const user_id = update["$push"].serials.u
        console.log(`User_${user_id} bought Item_${item_id}!`)
      }
    } catch (err) {
      console.log("Logging error:", err)
    }

    // Perform update
    const result = await collection.findOneAndUpdate(filter, update, {
      returnDocument: "after",
    })

    if (!result) {
      return res.status(404).json({
        status: "error",
        message: "No documents matched the filter",
      })
    }

    return res.status(200).json({
      status: "success",
      message: "Update successful",
      data: result,
    })
  } catch (error) {
    console.log("Internal Error:", error)
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    })
  }
})


// ======================================================================
//                      EXPORT APP FOR VERCEL
// ======================================================================
export default app

