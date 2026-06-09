import express from "express"
import pool from "./db.js"

const app = express()

const PORT = process.env.PORT || 3000

app.use(express.json())

// TEST ROUTE
app.get("/", (req, res) => {
  res.send("API running OK")
})

app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()")
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "DB error" })
  }
})

// IMPORTANTE: mantener servidor vivo
app.listen(PORT, () => {
  console.log("Server running")

  pool.query("SELECT NOW()")
    .then(r => console.log("DB OK"))
    .catch(e => console.error("DB ERROR", e))
})