const express = require('express');
const app = express();
const plats = require('./data/plats.json');
const path = require('path');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Route pour la recherche
app.post('/rechercher', (req, res) => {
    const allergies = req.body.allergies;
    
    const resultats = plats.map(plat => {
        let allergenesTotaux = [...plat.allergenes];

        if (plat.accompagnements) {
            plat.accompagnements.forEach(accompagnement => {
                allergenesTotaux = allergenesTotaux.concat(accompagnement.allergenes);
            });
        }

        let statut = "compatible";
        if (allergies.some(a => allergenesTotaux.some(all => all.toLowerCase().includes(a.toLowerCase())))) {
            statut = "incompatible";
        }

        return {
            nom: plat.nom,
            description: plat.description,
            allergenes: allergenesTotaux,
            status: statut
        };
    });

    res.json(resultats);
});

// Serveur (uniquement local pour test rapide, Vercel adaptera automatiquement)
app.listen(3000, () => console.log('Serveur lancé'));
