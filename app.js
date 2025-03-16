const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

let plats = [];
try {
    plats = require(path.join(__dirname, './data/plats.json'));
} catch (e) {
    console.error("Impossible de charger plats.json", e);
    plats = [];
}

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Fonction simplifiée pour comparer les chaînes
function comparerTexte(source, recherche) {
    source = source.toLowerCase().trim();
    recherche = recherche.toLowerCase().trim();
    
    return source.includes(recherche) || recherche.includes(source);
}

app.post('/rechercher', (req, res) => {
    const recherche = req.body.recherche || [];
    
    if (!recherche || !Array.isArray(recherche)) {
        return res.status(400).json({ erreur: "Critères de recherche mal envoyés depuis le client." });
    }

    try {
        const resultatParCategorie = {};
        
        plats.forEach(plat => {
            let allergenes = [...plat.allergenes];
            let statutPlat = "compatible";
            let accompagnementsCompatibles = [];
            let accompagnementsIncompatibles = [];
            let ingredientsModifiables = [];
            let ingredientsNonModifiables = [];
            
            // Vérifier les accompagnements
            if (plat.accompagnements) {
                plat.accompagnements.forEach(acc => {
                    let accStatus = "compatible";
                    const accAllergenes = acc.allergenes || [];
                    
                    for (const terme of recherche) {
                        if (accAllergenes.some(all => comparerTexte(all, terme))) {
                            accStatus = "incompatible";
                            break;
                        }
                    }
                    
                    if (accStatus === "compatible") {
                        accompagnementsCompatibles.push(acc.nom);
                    } else {
                        accompagnementsIncompatibles.push(acc.nom);
                    }
                });
            }
            
            // Vérifier les allergènes du plat
            let allergenesTrouves = false;
            for (const terme of recherche) {
                if (allergenes.some(all => comparerTexte(all, terme))) {
                    allergenesTrouves = true;
                    statutPlat = "incompatible";
                }
            }
            
            // Vérifier chaque ingrédient
            for (const terme of recherche) {
                for (const ingredient of plat.ingredients) {
                    if (comparerTexte(ingredient.nom, terme)) {
                        if (ingredient.modifiable) {
                            ingredientsModifiables.push(ingredient.nom);
                        } else {
                            ingredientsNonModifiables.push(ingredient.nom);
                        }
                    }
                }
            }
            
            // Déterminer le statut final
            if (ingredientsNonModifiables.length > 0) {
                statutPlat = "incompatible";
            } else if (ingredientsModifiables.length > 0) {
                statutPlat = "modifiable";
            }
            
            // Créer le résultat
            let ingredientsTotaux = plat.ingredients.map(ing => ing.nom);
            
            const resultatPlat = {
                nom: plat.nom,
                description: plat.description,
                allergenes: allergenes,
                ingredients: ingredientsTotaux,
                status: statutPlat,
                ingredientsModifiables: ingredientsModifiables,
                ingredientsNonModifiables: ingredientsNonModifiables
            };
            
            // Ajouter les accompagnements
            if (plat.accompagnements) {
                resultatPlat.accompagnements = {
                    compatibles: accompagnementsCompatibles,
                    incompatibles: accompagnementsIncompatibles
                };
            }
            
            // Ajouter à la catégorie
            const categorie = plat.categorie || "Non catégorisé";
            if (!resultatParCategorie[categorie]) {
                resultatParCategorie[categorie] = [];
            }
            
            resultatParCategorie[categorie].push(resultatPlat);
        });
        
        res.json(resultatParCategorie);
    } catch (error) {
        res.status(500).json({ erreur: "Erreur serveur : " + error.message });
    }
});

app.get('/rechercher', (req, res) => {
    res.status(200).send("🚀 Le serveur fonctionne, mais utilise POST pour accéder à cette route !");
});

app.listen(process.env.PORT || 3000);

module.exports = app;
