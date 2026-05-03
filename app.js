require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const session = require('express-session');

const app = express();
const port = 3000;

// --- 1. DATABASE CONNECTION ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- 2. MIDDLEWARE & SETTINGS ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

// Crucial: These must come BEFORE routes to handle form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'murphy_poly_secret_key',
    resave: false,
    saveUninitialized: true
}));

// --- 3. AUTHENTICATION MIDDLEWARE ---
const isAdmin = (req, res, next) => {
    if (req.session.isAdmin) {
        next();
    } else {
        res.redirect('/login');
    }
};

// --- 4. PUBLIC ROUTES ---

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
        res.render('products', { products: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error retrieving products");
    }
});

app.get('/contact', (req, res) => {
    res.render('contact');
});

app.get('/about', (req, res) => {
    res.render('about');
});

// --- 5. ORDER & INQUIRY HANDLING ---

app.post('/place-order', async (req, res) => {
    try {
        const { customerName, customerEmail, customerPhone, cartData } = req.body;
        const cart = JSON.parse(cartData); 

        let grandTotal = 0;
        cart.forEach(item => {
            grandTotal += (item.price * item.quantity);
        });

        res.render('receipt', { 
            customerName, 
            cart, 
            grandTotal, 
            orderId: Math.floor(100000 + Math.random() * 900000) 
        });
    } catch (err) {
        res.status(400).send("Invalid order data");
    }
});

app.post('/contact-submit', (req, res) => {
    const { name, phone, message } = req.body;
    console.log(`Inquiry from ${name}: ${message}`);
    res.send(`<h1>Thanks ${name}!</h1><p>We will call you at ${phone}.</p><a href="/">Home</a>`);
});

// --- 6. ADMIN SYSTEM ---

app.get('/login', (req, res) => res.render('login'));

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    // Note: In a real app, use environment variables for these
    if (username === 'admin' && password === 'Murphy2026') {
        req.session.isAdmin = true;
        res.redirect('/admin');
    } else {
        res.send("Invalid Credentials. <a href='/login'>Try again</a>");
    }
});

app.get('/admin', isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
        res.render('admin', { products: result.rows });
    } catch (err) {
        res.status(500).send("Error loading admin dashboard");
    }
});

app.post('/admin/add', isAdmin, async (req, res) => {
    const { name, category, specs, price, image_url } = req.body;
    try {
        await pool.query(
            'INSERT INTO products (name, category, specs, price, image_url) VALUES ($1, $2, $3, $4, $5)',
            [name, category, specs, price, image_url]
        );
        res.redirect('/admin');
    } catch (err) {
        res.status(500).send("Error adding product");
    }
});
// Show Edit Page
// 1. GET ROUTE: This shows the edit form when you click the "Edit" button
app.get('/admin/edit/:id', isAdmin, async (req, res) => {
    const productId = req.params.id;
    try {
        const result = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
        
        if (result.rows.length > 0) {
            // This renders your edit-product.ejs file and passes the product data to it
            res.render('edit-product', { product: result.rows[0] });
        } else {
            res.status(404).send("Product not found");
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading edit page");
    }
});

// 2. POST ROUTE: This handles the data when you click "Update Product" in the edit form
app.post('/admin/edit/:id', isAdmin, async (req, res) => {
    const productId = req.params.id;
    const { name, category, specs, price, image_url } = req.body;
    
    try {
        await pool.query(
            'UPDATE products SET name=$1, category=$2, specs=$3, price=$4, image_url=$5 WHERE id=$6',
            [name, category, specs, price, image_url, productId]
        );
        res.redirect('/admin'); // Go back to dashboard after saving
    } catch (err) {
        console.error(err);
        res.status(500).send("Error updating product");
    }
});

app.post('/admin/delete/:id', isAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
        res.redirect('/admin');
    } catch (err) {
        res.status(500).send("Error deleting product");
    }
});
app.get('/about', (req, res) => {
    res.render('about');
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// --- 7. START SERVER ---
app.listen(port, () => {
    console.log(`✅ Murphy Poly site running at http://localhost:${port}`);
});