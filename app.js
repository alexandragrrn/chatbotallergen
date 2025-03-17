const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Charger les données
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/restaurant_data.json'), 'utf8'));
const plats = data.plats;
const ingredients = data.ingredients;
const compositions = data.compositions;
const accompagnements = data.accompagnements;
const optionsAccompagnement = data.optionsAccompagnement;

// Fonction pour obtenir les ingrédients d'un plat
function getIngredientsPlat(platId) {
    const idsIngredients = compositions
        .filter(comp => comp.idPlat === platId)
        .map(comp => comp.idIngredient);
    
    return idsIngredients.map(id => {
        const ingredient = ingredients.find(ing => ing.id === id);
        const composition = compositions.find(comp => comp.idPlat === platId && comp.idIngredient === id);
        return {
            ...ingredient,
            modifiable: composition.modifiable
        };
    });
}

// Fonction pour obtenir les accompagnements d'un plat
function getAccompagnementsPlat(platId) {
    const idsAccompagnements = optionsAccompagnement
        .filter(opt => opt.idPlat === platId)
        .map(opt => opt.idAccompagnement);
    
    return idsAccompagnements.map(id => accompagnements.find(acc => acc.id === id));
}

// Fonction pour vérifier si des allergènes contiennent un terme de recherche
function contientAllergene(allergenes, terme) {
    if (!allergenes) return false;
    
    // Normaliser les allergènes et le terme de recherche
    const normaliserTexte = (texte) => {
        return texte.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\s]/g, "")
            .trim();
    };
    
    const allergenesList = allergenes.split(',').map(a => normaliserTexte(a.trim()));
    const termeNormalise = normaliserTexte(terme);
    
    return allergenesList.some(all => 
        all.includes(termeNormalise) || termeNormalise.includes(all)
    );
}

// Route principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route pour la recherche
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
                
                // Vérifier si l'ingrédient correspond à un nom recherché
                const estIngredientRecherche = recherche.some(terme => {
                    const normaliserTexte = (texte) => {
                        return texte.toLowerCase()
                            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                            .replace(/[^a-z0-9\s]/g, "")
                            .trim();
                    };
                    
                    const nomIngredientNormalise = normaliserTexte(ingredient.nom);
                    const termeRecherche = normaliserTexte(terme);
                    
                    return nomIngredientNormalise.includes(termeRecherche) || 
                           termeRecherche.includes(nomIngredientNormalise);
                });
                
                if (contientUnAllergeneRecherche || estIngredientRecherche) {
                    if (ingredient.modifiable === "Oui") {
                        ingredientsModifiables.push(ingredient.nom);
                        console.log(`Ingrédient modifiable trouvé dans ${plat.nom}: ${ingredient.nom}`);
                    } else {
                        ingredientsNonModifiables.push(ingredient.nom);
                        console.log(`Ingrédient NON modifiable trouvé dans ${plat.nom}: ${ingredient.nom}`);
                    }
                }
            });
            
            // Vérifier la compatibilité des accompagnements si le plat en a
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
            
            // Déterminer le statut global du plat
            let status;
            if (ingredientsNonModifiables.length > 0) {
                status = 'incompatible';
            } else if (ingredientsModifiables.length > 0) {
                status = 'modifiable';
            } else {
                status = 'compatible';
            }
            
            // Si le plat n'est pas totalement incompatible, l'ajouter aux résultats
            if (status !== 'incompatible' || ingredientsModifiables.length > 0) {
                // Créer la structure de résultat pour la catégorie si elle n'existe pas encore
                if (!resultatParCategorie[plat.categorie]) {
                    resultatParCategorie[plat.categorie] = [];
                }
                
                // Créer l'objet plat à renvoyer
                const platResult = {
                    id: plat.id,
                    nom: plat.nom,
                    description: plat.description,
                    status: status,
                    ingredients: ingredientsPlat.map(ing => ing.nom),
                    allergenes: Array.from(allergenes)
                };
                
                // Ajouter les ingrédients modifiables/non-modifiables si nécessaire
                if (ingredientsModifiables.length > 0) {
                    platResult.ingredientsModifiables = ingredientsModifiables;
                }
                
                if (ingredientsNonModifiables.length > 0) {
                    platResult.ingredientsNonModifiables = ingredientsNonModifiables;
                }
                
                // Ajouter les accompagnements si le plat en a
                if (plat.aDesAccompagnements === "Oui") {
                    platResult.accompagnements = {
                        compatibles: accompagnementsCompatibles,
                        incompatibles: accompagnementsIncompatibles
                    };
                }
                
                // Ajouter le plat à sa catégorie
                resultatParCategorie[plat.categorie].push(platResult);
            }
        });
        
        // Renvoyer les résultats
        res.json(resultatParCategorie);
        
    } catch (error) {
        console.error("Erreur lors de la recherche:", error);
        res.status(500).json({ erreur: "Erreur interne du serveur" });
    }
});

// Route pour l'interface de chat
app.get('/chat.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});

module.exports = app; // Pour les tests ou l'intégration avec Vercel
