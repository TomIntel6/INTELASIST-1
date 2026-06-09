import express from "express"

const app = express()

const PORT = process.env.PORT || 3000

app.use(express.json())

// TEST ROUTE
app.get("/", (req, res) => {
  res.send("API running OK")
})

// IMPORTANTE: mantener servidor vivo
app.listen(PORT, () => {
  console.log("Server running on port", PORT)
})