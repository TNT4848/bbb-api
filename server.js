const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();

// Allow both your links page and your panel to talk to this API
app.use(cors({
    origin: ["https://panel.tnt4848.com", "https://links.tnt4848.com"],
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 3306
});

// WAKE UP TEST: Visit your-url.onrender.com/ in a browser to see this
app.get('/', (req, res) => {
    res.send("TNT4848 API is Online and Awake");
});

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

// --- CLOUDFLARE STATS ---
app.post('/api/stats', async (req, res) => {
    const { password } = req.body;
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: "Unauthorized" });
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
        if (result.errors) return res.status(500).json({ error: "CF Error", details: result.errors });

        const stats = result.data.viewer.zones[0].httpRequests1dGroups[0].sum;
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

app.listen(process.env.PORT || 3000);