const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

let plats = [];
try {
    plats = require('./data/plats.json');
} catch (e) {
    console.error("Impossible de charger plats.json", e);
}

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/rechercher', (req, res) => {
    const allergies = req.body.allergies;

    if (!allergies || !Array.isArray(allergies)) {
        return res.status(400).json({ erreur: "Allergies mal envoyées depuis le client." });
    }

    try {
        const resultats = plats.map(plat => {
            let allergenesTotaux = [...plat.allergenes];

            if (plat.accompagnements) {
                plat.accompagnements.forEach(acc => {
                    allergenesTotaux.push(...acc.allergenes);
                });
            }

            const status = allergies.some(a => allergenesTotaux.some(all => all.toLowerCase().includes(a)))
                ? "incompatible"
                : "compatible";

            return {
                nom: plat.nom,
                description: plat.description,
                allergenes: allergenesTotaux,
                status
            };
        });

        res.json(resultats);
    } catch (error) {
        res.status(500).json({ erreur: "Erreur serveur : " + error.message });
    }
});

// route GET temporaire pour vérifier le fonctionnement clairement :
app.get('/rechercher', (req, res) => {
    res.status(200).send("🚀 Le serveur fonctionne, mais utilise POST pour accéder à cette route !");
});

app.listen(process.env.PORT || 3000);
