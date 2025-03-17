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
    console.log("Tentative de chargement des données...");
    const dataPath = path.join(__dirname, './data/restaurant_data.json');
    console.log("Chemin du fichier:", dataPath);
    
    const data = require(dataPath);
    console.log("Données chargées avec succès");
    
    ingredients = data.ingredients || [];
    plats = data.plats || [];
    compositions = data.compositions || [];
    accompagnements = data.accompagnements || [];
    optionsAccompagnement = data.optionsAccompagnement || [];
    
    console.log(`Nombre d'ingrédients: ${ingredients.length}`);
    console.log(`Nombre de plats: ${plats.length}`);
    console.log(`Nombre de compositions: ${compositions.length}`);
    console.log(`Nombre d'accompagnements: ${accompagnements.length}`);
    console.log(`Nombre d'options d'accompagnement: ${optionsAccompagnement.length}`);
} catch (e) {
    console.error("Impossible de charger les données", e);
    ingredients = [];
    plats = [];
    compositions = [];
    accompagnements = [];
    optionsAccompagnement = [];
}

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Fonction simplifiée de comparaison de texte
function contientAllergene(allergenes, terme) {
    // Si pas d'allergènes, retourne false
    if (!allergenes) return false;
    
    // Convertir en minuscules et diviser par virgule
    const listeAllergenes = allergenes.toLowerCase().split(',').map(a => a.trim());
    const termeRecherche = terme.toLowerCase().trim();
    
    // Vérifier si un des allergènes correspond au terme recherché
    return listeAllergenes.some(allergene => 
        allergene.includes(termeRecherche) || termeRecherche.includes(allergene)
    );
}

// Obtenir tous les ingrédients d'un plat
function getIngredientsPlat(idPlat) {
    const compsPlat = compositions.filter(comp => comp.idPlat === idPlat);
    
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
    
    if (!recherche || !Array.isArray(recherche) || recherche.length === 0) {
        return res.status(400).json({ erreur: "Critères de recherche invalides." });
    }

    try {
        const resultatParCategorie = {};
        
        // Traiter chaque plat
        plats.forEach(plat => {
            // Récupérer les ingrédients du plat
            const ingredientsPlat = getIngredientsPlat(plat.id);
            
            // Récupérer les allergènes du plat (à partir des ingrédients)
            const allergenes = new Set();
            ingredientsPlat.forEach(ing => {
                if (ing.allergenes) {
                    ing.allergenes.split(',').forEach(all => allergenes.add(all.trim()));
                }
            });
            
            // Vérifier la compatibilité des ingrédients
            let ingredientsModifiables = [];
            let ingredientsNonModifiables = [];
            
            // Vérifier chaque ingrédient par rapport aux critères de recherche
            ingredientsPlat.forEach(ingredient => {
                // Vérifier si l'ingrédient contient un des allergènes recherchés
                const contientUnAllergeneRecherche = recherche.some(terme => 
                    contientAllergene(ingredient.allergenes, terme)
                );
                
                if (contientUnAllergeneRecherche) {
                    if (ingredient.modifiable === "Oui") {
                        ingredientsModifiables.push(ingredient.nom);
                        console.log(`Ingrédient modifiable trouvé dans ${plat.nom}: ${ingredient.nom}`);
                    } else {
                        ingredientsNonModifiables.push(ingredient.nom);
                        console.log(`Ingrédient NON modifiable trouvé dans ${plat.nom}: ${ingredient.nom}`);
                    }
                }
            });
            
            // Déterminer le statut du plat
            let statutPlat = "compatible";
            
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
                    // Vérifier si l'accompagnement contient un des allergènes recherchés
                    const contientUnAllergeneRecherche = recherche.some(terme => 
                        contientAllergene(acc.allergenes, terme)
                    );
                    
                    if (contientUnAllergeneRecherche) {
                        accompagnementsIncompatibles.push(acc.nom);
                    } else {
                        accompagnementsCompatibles.push(acc.nom);
                    }
                });
            }
            
            // Créer le résultat pour ce plat
            const resultatPlat = {
                nom: plat.nom,
                description: plat.description,
                allergenes: Array.from(allergenes),
                ingredients: ingredientsPlat.map(ing => ing.nom),
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
            console.log(`Plat ${plat.nom} ajouté à la catégorie ${categorie} avec statut ${statutPlat}`);
        });
        
        console.log("Catégories trouvées:", Object.keys(resultatParCategorie));
        console.log("Nombre total de plats dans le résultat:", 
            Object.values(resultatParCategorie).reduce((total, plats) => total + plats.length, 0));
        
        res.json(resultatParCategorie);
    } catch (error) {
        console.error("Erreur serveur:", error);
        res.status(500).json({ erreur: "Erreur serveur : " + error.message });
    }
});

app.get('/rechercher', (req, res) => {
    res.status(200).send("🚀 Le serveur fonctionne, mais utilisez POST pour accéder à cette route !");
});

// Route de débogage améliorée
app.get('/debug', (req, res) => {
    // Récupérer tous les allergènes uniques
    const tousLesAllergenes = new Set();
    ingredients.forEach(ing => {
        if (ing.allergenes) {
            ing.allergenes.split(',').forEach(all => tousLesAllergenes.add(all.trim()));
        }
    });
    accompagnements.forEach(acc => {
        if (acc.allergenes) {
            acc.allergenes.split(',').forEach(all => tousLesAllergenes.add(all.trim()));
        }
    });

    res.json({
        stats: {
            ingredients: ingredients.length,
            plats: plats.length,
            compositions: compositions.length,
            accompagnements: accompagnements.length,
            optionsAccompagnement: optionsAccompagnement.length
        },
        allergenes: Array.from(tousLesAllergenes),
        ingredients: ingredients,
        plats: plats,
    });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
});

// Ajouter à app.js
app.post('/chat', (req, res) => {
    const userMessage = req.body.message || '';
    
    // Liste des allergènes connus depuis notre base de données
    const tousLesAllergenes = new Set();
    ingredients.forEach(ing => {
        if (ing.allergenes) {
            ing.allergenes.split(',').forEach(all => tousLesAllergenes.add(all.trim()));
        }
    });
    
    // Extraire les allergènes mentionnés dans le message
    const allergenesMentionnes = Array.from(tousLesAllergenes)
        .filter(allergene => userMessage.toLowerCase().includes(allergene.toLowerCase()));
    
    // Si des allergènes sont détectés, on utilise notre fonction de recherche existante
    if (allergenesMentionnes.length > 0) {
        // Utiliser la même logique que dans la route /rechercher
        // ...
        
        // Reformater les résultats pour une présentation conversationnelle
        const resultat = {
            allergenes: allergenesMentionnes,
            reponse: "Voici les plats compatibles avec vos allergies...",
            platsCompatibles: [],
            platsModifiables: [],
            platsIncompatibles: []
            // ...
        };
        
        res.json(resultat);
    } else {
        // Si pas d'allergènes détectés
        res.json({
            allergenes: [],
            reponse: "Je n'ai pas détecté d'allergènes dans votre message. Pourriez-vous préciser vos allergies ou les ingrédients à éviter?"
        });
    }
});

module.exports = app;
