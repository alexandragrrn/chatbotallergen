app.post('/rechercher', (req, res) => {
    const { allergies } = req.body;
    const plats = require('./data/plats.json');

    const resultats = plats.map(plat => {
        let allergenesTotaux = plat.allergenes;

        // Ajouter les allergènes des accompagnements si existants
        if (plat.accompagnements) {
            plat.accompagnements.forEach(acc => {
                allergenesTotaux = allergenesTotaux.concat(acc.allergenes);
            });
        }

        const platAllergenes = new Set([...plat.allergenes, ...(allergenesTotaux || [])]);
        const intersection = allergies.filter(a => platAllergeneExiste(platAllergenes, a));

        let status = intersection.length === 0 ? 'compatible' : 'incompatible';

        return {
            nom: plat.nom,
            description: plat.description,
            allergenes: Array.from(platAllergenes),
            status
        };
    });

    res.json(resultats);
});

// Vérifie les allergènes avec prise en compte orthographe, pluriel, majuscule
function platAllergeneExiste(allergenesPlat, allergieClient) {
    allergieClient = allergieClient.toLowerCase().trim();
    for (let allergene of allergenesPlat) {
        allergene = allergene.toLowerCase().trim();
        if (allergene.includes(allergieClient) || allergieClient.includes(allergene)) {
            return true;
        }
    }
    return false;
}

