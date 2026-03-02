// server.js
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// DATABASE CONNECTION
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "cooler_shop_db",
  port: 3307
});

db.connect((err) => {
  if (err) console.log("Database error:", err);
  else console.log("MySQL Connected");
});

// TEST
app.get("/", (req, res) => {
  res.send("Server is running");
});

/* ============ BRANDS ============ */

// GET BRANDS
app.get("/brands", (req, res) => {
  db.query("SELECT * FROM brands", (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

// ADD BRAND
app.post("/brands", (req, res) => {
  if (!req.body.name) return res.status(400).json("Brand name required");

  db.query(
    "INSERT INTO brands (name) VALUES (?)",
    [req.body.name],
    () => res.json("Brand Added")
  );
});

// DELETE BRAND (SAFE)
app.delete("/brands/:id", (req, res) => {
  db.query(
    "SELECT COUNT(*) AS c FROM coolers WHERE brand_id=?",
    [req.params.id],
    (err, r) => {
      if (r[0].c > 0)
        return res.status(400).json("Brand has coolers");

      db.query(
        "DELETE FROM brands WHERE id=?",
        [req.params.id],
        () => res.json("Brand Deleted")
      );
    }
  );
});

/* ============ CUSTOMERS ============ */

app.get("/customers", (req, res) => {
  db.query("SELECT * FROM customers", (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.post("/customers", (req, res) => {
  const { name, phone, email, address } = req.body;
  if (!name || !phone)
    return res.status(400).json("Name & phone required");

  db.query(
    "INSERT INTO customers (name, phone, email, address) VALUES (?,?,?,?)",
    [name, phone, email, address],
    (err, r) => res.json({ customer_id: r.insertId })
  );
});

app.delete("/customers/:id", (req, res) => {
  db.query(
    "DELETE FROM customers WHERE id=?",
    [req.params.id],
    () => res.json("Customer Deleted")
  );
});

/* ============ COOLERS ============ */

// GET COOLERS ✅ (FIXED QUERY)
app.get("/coolers", (req, res) => {
  db.query(
    `SELECT coolers.*, brands.name AS brand
     FROM coolers
     JOIN brands ON coolers.brand_id = brands.id`,
    (err, data) => {
      if (err) return res.status(500).json(err);
      res.json(data);
    }
  );
});

// ADD COOLER
app.post("/coolers", (req, res) => {
  const {
    brand_id,
    model_name,
    price,
    quantity,
    cooling_capacity,
    power_consumption
  } = req.body;

  if (!brand_id || !model_name || !price || !quantity)
    return res.status(400).json("Missing fields");

  db.query(
    `INSERT INTO coolers
     (brand_id, model_name, price, quantity, cooling_capacity, power_consumption)
     VALUES (?,?,?,?,?,?)`,
    [
      brand_id,
      model_name,
      price,
      quantity,
      cooling_capacity || null,
      power_consumption || null
    ],
    () => res.json("Cooler Added")
  );
});

// UPDATE STOCK
app.patch("/coolers/stock/:id", (req, res) => {
  db.query(
    "UPDATE coolers SET quantity=? WHERE id=?",
    [req.body.quantity, req.params.id],
    () => res.json("Stock Updated")
  );
});

// ✅ DELETE COOLER (IMPORTANT)
app.delete("/coolers/:id", (req, res) => {
  db.query(
    "DELETE FROM coolers WHERE id=?",
    [req.params.id],
    () => res.json("Cooler Deleted")
  );
});

/* ============ SALES ============ */

app.post("/sales", (req, res) => {
  const { customer_id, cooler_id, quantity, total_price, profit } = req.body;

  if (!customer_id || !cooler_id || !quantity)
    return res.status(400).json("Missing sale data");

  db.query(
    "INSERT INTO sales (customer_id, cooler_id, quantity, total_price, profit) VALUES (?,?,?,?,?)",
    [customer_id, cooler_id, quantity, total_price, profit],
    () => {
      db.query(
        "UPDATE coolers SET quantity = quantity - ? WHERE id=?",
        [quantity, cooler_id]
      );
      res.json("Sale Done");
    }
  );
});
// ================== SALES HISTORY ==================
app.get("/sales/history", (req, res) => {
  db.query(
    `SELECT 
        sales.id,
        sales.sale_date,
        sales.quantity,
        sales.total_price,
        customers.name AS customer_name,
        brands.name AS brand,
        coolers.model_name
     FROM sales
     JOIN customers ON sales.customer_id = customers.id
     JOIN coolers ON sales.cooler_id = coolers.id
     JOIN brands ON coolers.brand_id = brands.id
     ORDER BY sales.sale_date DESC`,
    (err, data) => {
      if (err) {
        console.log(err);
        return res.status(500).json(err);
      }
      res.json(data);
    }
  );
});
// TODAY'S TOTAL SALES
app.get("/sales/today", (req, res) => {
  db.query(
    `SELECT SUM(total_price) AS total 
     FROM sales 
     WHERE DATE(sale_date) = CURDATE()`,
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ total: result[0].total || 0 });
    }
  );
});

// PURCHASE HISTORY
app.get("/sales/customer/:id", (req, res) => {
  db.query(
    `SELECT sales.sale_date, sales.quantity, sales.total_price,
            coolers.model_name, brands.name AS brand
     FROM sales
     JOIN coolers ON sales.cooler_id = coolers.id
     JOIN brands ON coolers.brand_id = brands.id
     WHERE sales.customer_id=?`,
    [req.params.id],
    (err, data) => res.json(data)
  );
});

/* ============ START SERVER ============ */
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});