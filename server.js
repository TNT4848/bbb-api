const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();

// 1. IMPROVED CORS: Explicitly allow your domains to prevent "Cannot Connect" errors
app.use(cors({
    origin: ["https://panel.tnt4848.com", "https://links.tnt4848.com"],
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

// 2. DATABASE POOL WITH ERROR HANDLING
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Basic Health Check to see if server is alive
app.get('/', (req, res) => {
    res.send("TNT4848 API is Online");
});

// --- LINK MANAGEMENT ROUTES ---

app.get('/links', (req, res) => {
    db.query('SELECT * FROM bbb_pages', (err, results) => {
        if (err) {
            console.error("DB Error:", err);
            return res.status(500).json({ error: "Database read failed" });
        }
        res.json(results);
    });
});

app.post('/links', (req, res) => {
    const { name, url, password } = req.body;
    if (password !== process.env.ADMIN_PASSWORD) return res.status(401).send("Wrong Password");
    
    db.query('INSERT INTO bbb_pages (name, url) VALUES (?, ?)', [name, url], (err) => {
        if (err) return res.status(500).send(err);
        res.send("Success");
    });
});

app.delete('/links/:id', (req, res) => {
    const { password } = req.body;
    if (password !== process.env.ADMIN_PASSWORD) return res.status(401).send("Wrong Password");
    
    db.query('DELETE FROM bbb_pages WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).send(err);
        res.send("Deleted");
    });
});

// --- CLOUDFLARE STATS ROUTE ---

app.post('/api/stats', async (req, res) => {
    const { password } = req.body;

    // Security Check
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    // Ensure Env Variables exist before calling Cloudflare
    if (!process.env.CF_ZONE_ID || !process.env.CF_API_TOKEN) {
        return res.status(500).json({ error: "Server missing Cloudflare API keys" });
    }

    const query = {
        query: `{
            viewer {
                zones(filter: { zoneTag: "${process.env.CF_ZONE_ID}" }) {
                    httpRequests1dGroups(limit: 1, orderBy: [date_DESC]) {
                        sum {
                            requests
                            pageViews
                        }
                    }
                }
            }
        }`
    };

    try {
        const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.CF_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(query)
        });

        const result = await response.json();

        if (result.errors) {
            return res.status(500).json({ error: "Cloudflare API Error", details: result.errors });
        }

        // Check if data exists in the response
        if (result.data && result.data.viewer.zones.length > 0) {
            const stats = result.data.viewer.zones[0].httpRequests1dGroups[0].sum;
            res.json(stats);
        } else {
            res.status(404).json({ error: "No traffic data found for this zone" });
        }
    } catch (err) {
        console.error("Fetch Error:", err);
        res.status(500).json({ error: "Internal Server Error during Cloudflare fetch" });
    }
});

// 3. START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`TNT4848 System running on port ${PORT}`);
});