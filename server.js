require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // allow base64 images
app.use(express.static(path.join(__dirname, 'public')));

/* ─── MongoDB Connection ─── */
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

/* ─── Product Schema ─── */
const productSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  cat:     { type: String, required: true, enum: ['Gold', 'Silver', 'Bridal', 'Diamond'] },
  price:   { type: Number, required: true },
  weight:  { type: String, default: '' },
  img:     { type: String, default: '' }, // base64 or URL
  desc:    { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

/* ─── Seed Default Products ─── */
const DEFAULT_PRODUCTS = [
  { name: 'Royal Kundan Necklace Set',   cat: 'Gold',    price: 185000, weight: '42',  desc: 'Exquisite 22K gold Kundan necklace with matching earrings and maang tikka. A masterpiece of Rajasthani craftsmanship.' },
  { name: 'Solitaire Diamond Ring',      cat: 'Diamond', price: 220000, weight: '5.2', desc: '0.75ct GIA certified round brilliant diamond set in 18K white gold. The perfect symbol of eternal love.' },
  { name: 'Bridal Gold Choker Set',      cat: 'Bridal',  price: 310000, weight: '85',  desc: 'Heavy 22K gold choker with intricate meenakari work. Complete bridal set including earrings, maang tikka and bangles.' },
  { name: 'Silver Filigree Anklets',     cat: 'Silver',  price: 8500,   weight: '28',  desc: 'Handcrafted 92.5 sterling silver anklets with traditional Bengali filigree work. Pair of two.' },
  { name: 'Gold Bangle Set (Dozen)',     cat: 'Gold',    price: 95000,  weight: '60',  desc: 'Classic 22K gold plain and design bangles. Set of 12. Perfect for daily wear and special occasions.' },
  { name: 'Diamond Tennis Bracelet',     cat: 'Diamond', price: 145000, weight: '8.5', desc: '18K white gold bracelet set with 3.5ct of VS clarity diamonds. Timeless and versatile luxury.' },
  { name: 'Temple Jewellery Set',        cat: 'Bridal',  price: 42000,  weight: '55',  desc: 'South Indian style temple jewellery in gold-plated with antique finish. Ideal for classical dance and weddings.' },
  { name: 'Silver Pooja Thali Set',      cat: 'Silver',  price: 15000,  weight: '180', desc: '92.5 silver pooja thali with traditional engravings. Complete set with diya, kalash, and accessories.' },
  { name: 'Emerald Gold Earrings',       cat: 'Gold',    price: 58000,  weight: '9.4', desc: '22K gold earrings with natural Columbian emeralds. Jhumka style with intricate filigree border.' },
  { name: 'Diamond Solitaire Pendant',   cat: 'Diamond', price: 88000,  weight: '3.8', desc: '0.5ct princess cut diamond pendant in 18K yellow gold chain. Certificate of authenticity included.' },
];

async function seedIfEmpty() {
  const count = await Product.countDocuments();
  if (count === 0) {
    await Product.insertMany(DEFAULT_PRODUCTS);
    console.log('🌱 Seeded default products');
  }
}
mongoose.connection.once('open', seedIfEmpty);

/* ─── Auth Middleware ─── */
function adminOnly(req, res, next) {
  const pwd = req.headers['x-admin-password'];
  if (pwd !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

/* ─── Routes ─── */

// GET all products (with optional search/filter)
app.get('/api/products', async (req, res) => {
  try {
    const { cat, search } = req.query;
    const filter = {};
    if (cat) filter.cat = cat;
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { desc: { $regex: search, $options: 'i' } }
    ];
    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single product
app.get('/api/products/:id', async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create product (admin only)
app.post('/api/products', adminOnly, async (req, res) => {
  try {
    const p = new Product(req.body);
    await p.save();
    res.status(201).json(p);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update product (admin only)
app.put('/api/products/:id', adminOnly, async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE product (admin only)
app.delete('/api/products/:id', adminOnly, async (req, res) => {
  try {
    const p = await Product.findByIdAndDelete(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify admin password
app.post('/api/admin/verify', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid password' });
  }
});

// Serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
