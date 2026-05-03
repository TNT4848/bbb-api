const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();

// Open CORS to prevent any browser blocking
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 3306
});

// Root route for health check
app.get('/', (req, res) => res.send("TNT4848 API is Online"));

// --- LINK MANAGEMENT ---
app.get('/links', (req, res) => {
    db.query('SELECT * FROM bbb_pages', (err, results) => {
        if (err) return res.status(500).send(err);
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

// --- CLOUDFLARE STATS (Enhanced Query) ---
app.post('/api/stats', async (req, res) => {
    const { password } = req.body;
    if (password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });

    // Looks at the last 24 hours of raw adaptive traffic (better for subdomains)
    const query = {
        query: `{
            viewer {
                zones(filter: { zoneTag: "${process.env.CF_ZONE_ID}" }) {
                    httpRequestsAdaptiveGroups(limit: 1, filter: { datetime_gt: "${new Date(Date.now() - 86400000).toISOString()}" }) {
                        count
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
            return res.status(500).json({ error: result.errors[0].message });
        }

        const zoneData = result.data?.viewer?.zones?.[0];

        if (zoneData) {
            const count = zoneData.httpRequestsAdaptiveGroups[0]?.count || 0;
            res.json({
                requests: count,
                pageViews: Math.floor(count * 0.75) // Statistical estimate for page views
            });
        } else {
            res.status(500).json({ error: "Zone not found or API misconfigured" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server Internal Error" });
    }
});

app.listen(process.env.PORT || 3000);