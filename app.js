const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const plats = require('./data/plats.json');

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/rechercher', (req, res) => {
    try {
        const allergies = req.body.allergies;

        if (!allergies) {
            return res.status(400).json({ error: "Aucune allergie fournie." });
        }

        const resultats = plats.map(plat => {
            let allergenesTotaux = [...plat.allergenes];

            if (plat.accompagnements) {
                plat.accompagnements.forEach(acc => {
                    if (acc.allergenes) allergenesTotaux.push(...acc.allergenes);
                });
            }

            let status = "compatible";
            if (allergies.some(allergie =>
                allergenesTotaux.some(all => all.toLowerCase().includes(allergie))
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
    } catch (error) {
        res.status(500).send(`Erreur serveur : ${error.message}`);
    }
});

// Route GET temporaire pour débuguer :
app.get('/rechercher', (req, res) => {
    res.send('La route fonctionne, mais uniquement en POST !');
});

app.listen(process.env.PORT || 3000);
