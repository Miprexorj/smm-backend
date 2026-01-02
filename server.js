const express = require("express");
const fetch = require("node-fetch"); // Node 18+ ise gerek yok
const app = express();

app.use(express.json());
app.use((req,res,next)=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","*");
  if(req.method==="OPTIONS") return res.sendStatus(200);
  next();
});

// RAM database (geçici)
let users = { admin: { pass:"123456", balance:0, role:"admin" } };
let orders = []; // siparişleri kaydetmek için

// ----------------------
// REGISTER
// ----------------------
app.post("/register",(req,res)=>{
  const { u,p } = req.body;
  if(!u||!p) return res.json({ ok:false, msg:"Eksik bilgi" });
  if(users[u]) return res.json({ ok:false, msg:"Kullanıcı zaten var" });
  users[u] = { pass:p, balance:0, role:"user" };
  res.json({ ok:true, msg:"Kayıt başarılı" });
});

// ----------------------
// LOGIN
// ----------------------
app.post("/login",(req,res)=>{
  const { u,p } = req.body;
  if(!users[u]||users[u].pass!==p) return res.json({ ok:false });
  res.json({ ok:true, role:users[u].role, balance:users[u].balance });
});

// ----------------------
// ADMIN PANEL → kullanıcı listesi
// ----------------------
app.get("/admin/users",(req,res)=>{
  const userList = Object.keys(users).map(u=>{
    return { username:u, role:users[u].role, balance:users[u].balance };
  });
  res.json(userList);
});

// ----------------------
// SMM ORDER endpoint
// ----------------------
app.post("/order", async (req,res)=>{
  const { username, service, link, quantity } = req.body;

  if(!users[username]) return res.json({ ok:false, msg:"Kullanıcı yok" });

  // Service fiyatları TL cinsinden
  let servicePriceTL = 0;
  let providerPriceTL = 0;

  if(service == 101){ // Beğeni
    servicePriceTL = 20 * (quantity/1000);  // 1K = 20 TL
    providerPriceTL = 5 * (quantity/1000);  // Provider maliyeti
  }
  else if(service == 102){ // Takipçi
    servicePriceTL = 100 * (quantity/1000); // 1K = 100 TL
    providerPriceTL = 30 * (quantity/1000); // Provider maliyeti
  }
  else if(service == 103){ // İzlenme / Views
    servicePriceTL = 30 * (quantity/1000);  // 1K = 30 TL
    providerPriceTL = 15 * (quantity/1000); // Provider maliyeti
  }

  const userPriceTL = servicePriceTL;
  const profitTL = userPriceTL - providerPriceTL;

  // Siparişi kaydet
  orders.push({
    username, service, link, quantity,
    userPriceTL, providerPriceTL, profitTL, date: new Date()
  });

  // Kullanıcı balance’ına kar ekle
  users[username].balance += profitTL;

  // ----------------------
  // Provider API çağrısı (gerçek sipariş)
  // ----------------------
  try {
    const response = await fetch("https://provider.com/api/v2", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        api_token: "820cf40410ddfa6c07e865b26d41dd1d", // SENİN API KEY
        action: "add",
        service: service,
        link: link,
        quantity: quantity
      })
    });
    const data = await response.json();
    res.json({ ok:true, provider:data, userPriceTL, profitTL });
  } catch(err) {
    res.status(500).json({ ok:false, error:err.message });
  }
});

// ----------------------
// Admin panel → sipariş listesi
// ----------------------
app.get("/admin/orders",(req,res)=>{
  res.json(orders);
});

// ----------------------
// Root
// ----------------------
app.get("/",(req,res)=>res.send("SMM PANEL AKTİF 🚀"));

// ----------------------
// Server start
// ----------------------
app.listen(process.env.PORT||3000,()=>console.log("Server çalışıyor"));
