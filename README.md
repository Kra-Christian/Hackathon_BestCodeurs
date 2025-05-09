# Hackathon_BestCodeurs - Chatbot WhatsApp pour Établissements Scolaires

## Description du projet

**Hackathon_BestCodeurs** est une solution innovante développée pour automatiser les interactions entre les parents et les établissements scolaires via WhatsApp. Ce chatbot intelligent permet de fournir des informations clés telles que les notes des élèves, les absences, les devoirs, et bien plus encore. Grâce à l'intégration de la reconnaissance vocale et de la synthèse vocale, les utilisateurs peuvent interagir avec le bot par messages texte ou vocaux.

Ce projet a été conçu et développé par une équipe de **quatre développeurs** :

- **Trois Data Analysts** spécialisés dans le traitement du langage naturel (NLP) et l'analyse des données.
- **Un Développeur Full Stack** responsable de l'architecture backend et de l'intégration des services.

---

## Fonctionnalités principales

### 🔹 Gestion des demandes

- **Notes des élèves** : Consultation des notes par matière ou globalement.
- **Absences** : Vérification des absences ou retards d'un élève.
- **Devoirs** : Liste des devoirs à faire pour une matière spécifique.
- **Informations générales** : Détails sur l'école, les classes, ou les sections.

### 🔹 Interaction vocale

- **Synthèse vocale (TTS)** : Le bot peut lire les réponses textuelles à haute voix.
- **Reconnaissance vocale (STT)** : Les utilisateurs peuvent envoyer des messages vocaux pour interagir avec le bot.

### 🔹 Intégration avec WhatsApp

- Utilisation de l'API Twilio pour gérer les messages texte et vocaux.

### 🔹 Traitement du langage naturel (NLP)

- Détection des intentions utilisateur (intent) grâce à `node-nlp`.
- Extraction des informations clés comme le nom de l'élève, la matière, ou la période.

---

## Technologies utilisées

### Backend

- **Node.js** : Environnement d'exécution JavaScript.
- **Express.js** : Framework web pour la gestion des routes et des requêtes.

### Services externes

- **Twilio API** : Gestion des messages WhatsApp.
- **AssemblyAI** : Reconnaissance vocale (STT).
- **VoiceRSS** et **LibreTranslate** : Synthèse vocale (TTS).

### Traitement des données

- **node-nlp** : Analyse et traitement du langage naturel.
- **Winston** : Gestion avancée des logs.

---

## Installation et configuration

### Prérequis

- **Node.js** (v14 ou supérieur)
- **npm** (v6 ou supérieur)

### Étapes d'installation

1. Clonez le dépôt

2. Installez les dépendances :

   ```bash
   npm install
   ```

3. Configurez les variables d'environnement dans un fichier .env :

   ```properties
   PORT=3000
   TWILIO_ACCOUNT_SID=Votre_Twilio_SID
   TWILIO_AUTH_TOKEN=Votre_Twilio_Token
   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
   ASSEMBLY_API_KEY=Votre_AssemblyAI_API_Key
   VOICERSS_API_KEY=Votre_VoiceRSS_API_Key
   ```

4. Lancez le serveur :

   ```bash
   node index.js
   ```

5. Le serveur sera disponible sur le port défini dans le fichier .env (par défaut : `http://localhost:3000`).

---

## Utilisation

### Commandes texte

- **"Notes de Aminata"** : Affiche les notes de l'élève Aminata.
- **"Absences de Karim"** : Liste les absences de l'élève Karim.
- **"Devoirs en mathématiques"** : Affiche les devoirs de mathématiques.

### Commandes vocales

- Envoyez un message vocal avec une commande comme :
  - "Lis-moi les notes de Aminata."
  - "Dis-moi les absences de Karim."
  - "Quels sont les devoirs en mathématiques ?"

Le bot répondra avec un message texte et un fichier audio.

---

## Contributions

Ce projet a été développé par une équipe de quatre développeurs :

- **Trois Data Analysts** : Analyse des données et implémentation du NLP.
- **Un Développeur Full Stack** : Architecture backend et intégration des services.

---
