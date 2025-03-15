const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const plats = require('./data/plats.json');

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/rechercher', (req, res) => {
    const allergies = req.body.allergies.map(a => a.trim().toLowerCase());

    const resultats = plats.map(plat => {
        let allergenesTotaux = [...plat.allergenes];

        // On inclut les allergènes des accompagnements s'ils existent
        if (plat.accompagnements) {
            plat.accompagnements.forEach(acc => {
                if (acc.allergenes) allergenesTotaux.push(...acc.allergenes);
            });
        }

        let status = "compatible";
        if (allergies.some(allergie =>
            allergenesTotaux.some(all => all.toLowerCase().includes(allergie.toLowerCase()))
        )) {
            status = "incompatible";
        }

        return {
            nom: plat.nom,
            description: plat.description,
            allergenes: allergenesTotaux,
            status
        };
    });

    res.json(resultats);
});

app.listen(process.env.PORT || 3000);
