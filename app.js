const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// Structures de données
let ingredients = [];
let plats = [];
let compositions = [];
let accompagnements = [];
let optionsAccompagnement = [];

// Chargement des données
try {
    // Utiliser console.log pour le débogage
    console.log("Tentative de chargement des données...");
    const dataPath = path.join(__dirname, './data/restaurant_data.json');
    console.log("Chemin du fichier:", dataPath);
    
    const data = require(dataPath);
    console.log("Données chargées avec succès");
    
    // Logging des données pour le débogage
    console.log(`Nombre d'ingrédients: ${data.ingredients ? data.ingredients.length : 0}`);
    console.log(`Nombre de plats: ${data.plats ? data.plats.length : 0}`);
    
    ingredients = data.ingredients || [];
    plats = data.plats || [];
    compositions = data.compositions || [];
    accompagnements = data.accompagnements || [];
    optionsAccompagnement = data.optionsAccompagnement || [];
} catch (e) {
    console.error("Impossible de charger les données", e);
    // Initialiser avec des données vides
    ingredients = [];
    plats = [];
    compositions = [];
    accompagnements = [];
    optionsAccompagnement = [];
}

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Fonction améliorée pour comparer les chaînes
function comparerTexte(source, recherche) {
    // Vérifier si les valeurs sont définies
    if (!source || !recherche) return false;
    
    source = source.toLowerCase().trim();
    recherche = recherche.toLowerCase().trim();
    
    // Vérifier l'inclusion dans les deux sens
    return source.includes(recherche) || recherche.includes(source);
}

// Obtenir tous les ingrédients d'un plat
function getIngredientsPlat(idPlat) {
    // Vérifier si les compositions existent
    if (!compositions || compositions.length === 0) {
        console.log(`Pas de compositions trouvées pour le plat ${idPlat}`);
        return [];
    }
    
    const compsPlat = compositions.filter(comp => comp.idPlat === idPlat);
    console.log(`${compsPlat.length} compositions trouvées pour le plat ${idPlat}`);
    
    return compsPlat.map(comp => {
        const ingredient = ingredients.find(ing => ing.id === comp.idIngredient);
        return {
            id: comp.idIngredient,
            nom: ingredient ? ingredient.nom : 'Inconnu',
            allergenes: ingredient ? ingredient.allergenes : '',
            modifiable: comp.modifiable
        };
    });
}

// Obtenir tous les accompagnements d'un plat
function getAccompagnementsPlat(idPlat) {
    const idsAccompagnement = optionsAccompagnement
        .filter(opt => opt.idPlat === idPlat)
        .map(opt => opt.idAccompagnement);
    
    return accompagnements.filter(acc => idsAccompagnement.includes(acc.id));
}

app.post('/rechercher', (req, res) => {
    const recherche = req.body.recherche || [];
    
    console.log("Recherche reçue:", recherche);
    
    if (!recherche || !Array.isArray(recherche)) {
        return res.status(400).json({ erreur: "Critères de recherche mal envoyés depuis le client." });
    }

    try {
        console.log(`Recherche parmi ${plats.length} plats`);
        const resultatParCategorie = {};
        
        plats.forEach(plat => {
            console.log(`Traitement du plat: ${plat.nom} (ID: ${plat.id})`);
            
            // Récupérer les ingrédients du plat
            const ingredientsPlat = getIngredientsPlat(plat.id);
            console.log(`${ingredientsPlat.length} ingrédients trouvés pour ${plat.nom}`);
            
            // Récupérer les allergènes du plat (à partir des ingrédients)
            const allergenes = new Set();
            ingredientsPlat.forEach(ing => {
                if (ing.allergenes) {
                    ing.allergenes.split(',').forEach(all => allergenes.add(all.trim()));
                }
            });
            
            // Vérifier la compatibilité des ingrédients avec les critères de recherche
            let statutPlat = "compatible";
            let ingredientsModifiables = [];
            let ingredientsNonModifiables = [];
            
            // Vérifier chaque ingrédient par rapport aux critères de recherche
            ingredientsPlat.forEach(ingredient => {
                const allergenesTrouvees = [];
                
                if (ingredient.allergenes) {
                    const allergenesList = ingredient.allergenes.split(',').map(a => a.trim());
                    
                    for (const terme of recherche) {
                        if (allergenesList.some(all => comparerTexte(all, terme))) {
                            allergenesTrouvees.push(terme);
                        }
                    }
                }
                
                if (allergenesTrouvees.length > 0) {
                    if (ingredient.modifiable === "Oui") {
                        ingredientsModifiables.push(ingredient.nom);
                    } else {
                        ingredientsNonModifiables.push(ingredient.nom);
                    }
                }
            });
            
            // Déterminer le statut final du plat
            if (ingredientsNonModifiables.length > 0) {
                statutPlat = "incompatible";
            } else if (ingredientsModifiables.length > 0) {
                statutPlat = "modifiable";
            }
            
            // Vérifier les accompagnements
            let accompagnementsCompatibles = [];
            let accompagnementsIncompatibles = [];
            
            if (plat.aDesAccompagnements === "Oui") {
                const accompagnementsPlat = getAccompagnementsPlat(plat.id);
                
                accompagnementsPlat.forEach(acc => {
                    let accStatus = "compatible";
                    
                    if (acc.allergenes) {
                        const allergenesList = acc.allergenes.split(',').map(a => a.trim());
                        
                        for (const terme of recherche) {
                            if (allergenesList.some(all => comparerTexte(all, terme))) {
                                accStatus = "incompatible";
                                break;
                            }
                        }
                    }
                    
                    if (accStatus === "compatible") {
                        accompagnementsCompatibles.push(acc.nom);
                    } else {
                        accompagnementsIncompatibles.push(acc.nom);
                    }
                });
            }
            
            // Créer le résultat pour ce plat
            const ingredientsTotaux = ingredientsPlat.map(ing => ing.nom);
            
            const resultatPlat = {
                nom: plat.nom,
                description: plat.description,
                allergenes: Array.from(allergenes),
                ingredients: ingredientsTotaux,
                status: statutPlat,
                ingredientsModifiables: ingredientsModifiables,
                ingredientsNonModifiables: ingredientsNonModifiables
            };
            
            // Ajouter les accompagnements si nécessaire
            if (plat.aDesAccompagnements === "Oui") {
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
        
        console.log("Résultats par catégorie:", Object.keys(resultatParCategorie));
        res.json(resultatParCategorie);
    } catch (error) {
        console.error("Erreur serveur:", error);
        res.status(500).json({ erreur: "Erreur serveur : " + error.message });
    }
});

app.get('/rechercher', (req, res) => {
    res.status(200).send("🚀 Le serveur fonctionne, mais utilise POST pour accéder à cette route !");
});

// Ajout d'une route pour vérifier les données chargées
app.get('/debug', (req, res) => {
    res.json({
        ingredients: ingredients.length,
        plats: plats.length,
        compositions: compositions.length,
        accompagnements: accompagnements.length,
        optionsAccompagnement: optionsAccompagnement.length,
        platsDetails: plats
    });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
});

module.exports = app;
