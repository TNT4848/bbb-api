const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 3306
});

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

app.listen(process.env.PORT || 3000);
