const express = require('express');
const app = express();
const plats = require('./data/plats.json');

app.use(express.json());

app.post('/rechercher', (req, res) => {
    const allergies = req.body.allergies;
    const results = plats.map(plat => {
        let allergenesLower = plat.allergenes.map(a => a.toLowerCase());
        let incompatible = allergies.some(allergie => allergenesLower.includes(allergie));

        return {
            nom: plat.nom,
            description: plat.description,
            allergenes: plat.allergenes,
            status: incompatible ? 'incompatible' : 'compatible'
        };
    });
    res.json(results);
});

app.listen(process.env.PORT || 3000);
