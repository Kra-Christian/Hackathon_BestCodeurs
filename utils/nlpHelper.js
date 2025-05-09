const { NlpManager } = require("node-nlp");
const logger = require("./logger");
const path = require("path");
const fs = require("fs");

class NlpHelper {
  constructor() {
    this.manager = new NlpManager({ 
      languages: ["fr"], 
      forceNER: true,
      nlu: { log: true }
    });
    
    this.intentPatterns = {
      greeting: [
        'bonjour', 'bonsoir', 'salut', 'hello', 'coucou',
        'hey', 'bonne journée', 'bonne soirée'
      ],
      grades: [
        'notes', 'note', 'moyenne', 'bulletin', 'résultat', 
        'résultats', 'bulletins', 'moyenne', 'évaluation',
        'contrôle', 'examen', 'test'
      ],
      attendance: [
        'absence', 'absences', 'présence', 'présent', 'absent',
        'retard', 'retards', 'assiduité', 'présente', 'était',
        'venue', 'venu', 'là', 'présents', 'assisté'
      ],
      homework: [
        'devoir', 'devoirs', 'exercice', 'exercices', 'travail',
        'leçon', 'leçons', 'à faire', 'révisions', 'contrôles'
      ],
      school: [
        'école', 'ecole', 'lycée', 'college', 'collège',
        'établissement', 'institut', 'institution', 'scolarité',
        'classe', 'niveau', 'section'
      ]
    };

    this.stopWords = [
      'les', 'des', 'de', 'la', 'le', 'du', 
      'voir', 'consulter', 'obtenir', 'donner',
      'mon', 'ma', 'mes', 'pour', 'sur',
      
      'bonjour', 'bonsoir', 'salut', 'hello', 'coucou',
      'hey', 'bonne', 'journée', 'soirée',
      
      'note', 'notes', 'bulletin', 'moyenne', 'résultat',
      'résultats', 'devoir', 'devoirs', 'absence', 'absences',
      'présence', 'école', 'matière', 'matières'
    ];

    this.subjectPatterns = {
      'mathematique': ['math', 'maths', 'mathematique', 'mathématique', 'mathématiques', 'calcul'],
      'francais': ['francais', 'français', 'fr', 'french', 'littérature', 'dictée'],
      'anglais': ['anglais', 'eng', 'english', 'langue anglaise'],
      'histoire': ['histoire', 'history', 'hist'],
      'geographie': ['geographie', 'géographie', 'geo', 'géo'],
      'physique': ['physique', 'physics', 'phys'],
      'chimie': ['chimie', 'chemistry', 'chim'],
      'svt': ['svt', 'science', 'biologie', 'sciences naturelles', 'bio']
    };

    this.timeReferences = {
      'hier': -1,
      'aujourd\'hui': 0,
      'demain': 1,
      'avant-hier': -2,
      'apres-demain': 2, 
      'après-demain': 2
    };

    this.initialized = false;
    this.modelPath = path.join(__dirname, "../model.nlp");
    this.initialize();

    this.voicePatterns = {
      reading: [
        'lis', 'lire', 'lit', 'lecture', 'vocal',
        'audio', 'voix', 'parle', 'dire', 'dis',
        'écouter', 'écoute', 'entendre'
      ],
      startPatterns: [
        /^(lis|lire|dis|dire|parle)\s+/i,
        /^en\s+(vocal|audio|voix)/i,
        /^écouter\s+/i
      ],
      endPatterns: [
        /\s+en\s+(vocal|audio|voix)$/i,
        /\s+à\s+voix\s+haute$/i
      ]
    };
  }

  async initialize() {
    try {
      if (fs.existsSync(this.modelPath)) {
        await this.manager.load(this.modelPath);
        this.initialized = true;
        logger.info("Modèle NLP chargé depuis le fichier");
        return;
      }
    } catch (error) {
      logger.error(`Erreur lors du chargement du modèle NLP: ${error.message}`);
    }

    const variations = {
      greeting: [
        "bonjour", "salut", "bonsoir", "hello", "coucou",
        "bonjour *", "salut *", "bonsoir *", "hello *",
        "* bonjour", "* bonsoir", "* salut"
      ],
      grades: [
        "notes de *", "bulletin de *", "moyennes de *",
        "* a quelles notes", "résultats de *",
        "voir les notes de *", "consulter les notes de *",
        "* notes", "notes *", "bulletin *", 
        "* notes en *", "notes * en *", "moyenne de * en *",
        "notes de * en math*", "résultats * en français"
      ],
      attendance: [
        "absences de *", "* est absent", "* était absent",
        "présence de *", "* est présent", "assiduité de *",
        "retards de *", "* a des absences", "* était présente hier",
        "* était là *", "* présente *", "* était * hier"
      ],
      homework: [
        "devoirs de *", "* a quoi comme devoirs",
        "exercices pour *", "leçons de *",
        "travail pour *", "devoirs *",
        "devoirs de * en *", "* a * devoir en *", 
        "quels exercices pour * en *"
      ],
      school: [
        "école de *", "* va à quelle école", 
        "établissement de *", "* est scolarisé où",
        "où étudie *", "* fréquente quelle école"
      ]
    };

    Object.entries(variations).forEach(([intent, patterns]) => {
      patterns.forEach(pattern => {
        this.manager.addDocument("fr", pattern, intent);
      });
    });

    await this.manager.train();
    await this.manager.save(this.modelPath);
    this.initialized = true;
    logger.info("Modèle NLP initialisé et entraîné avec succès");
  }

  async detectIntent(msg) {
    try {
      const lowerMsg = msg.toLowerCase().trim();
      
      if (this.intentPatterns.greeting.some(pattern => 
        lowerMsg.includes(pattern.toLowerCase()))) {
        logger.info(`Salutation détectée dans: "${msg}"`);
        return 'greeting';
      }

      logger.info(`Tentative de détection d'intent pour: "${msg}"`);
      
      for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
          for (const pattern of patterns) {
              if (lowerMsg.includes(pattern.toLowerCase())) {
                  logger.info(`Intent détecté: ${intent} via pattern: ${pattern}`);
                  return intent;
              }
          }
      }

      if (!this.initialized) await this.initialize();
      const res = await this.manager.process("fr", msg);
      
      logger.info(`Message: "${msg}" → Intent via NLP: ${res.intent || 'unknown'} (score: ${res.score})`);
      return (res.intent && res.score > 0.4) ? res.intent : "unknown";

    } catch (error) {
      logger.error(`Erreur dans detectIntent: ${error.message}`);
      return "unknown";
    }
  }

  extractStudentName(message) {
    try {
      let cleanedMessage = message.trim();
      
      cleanedMessage = cleanedMessage.replace(/^(les?|des?|la|pour|de)\s+/i, '');
      
      const patterns = [
        /(?:de|d'|pour|à)\s+([A-ZÀ-Ý][a-zà-ÿ'-]+)/i,
        
        /([A-ZÀ-Ý][a-zà-ÿ'-]+)\s+(?:en|a|pour)\s+/i,
        
        // Format: "notes/devoirs de [Nom]"
        /(?:notes?|devoirs?|absences?)\s+(?:de|d')\s+([A-ZÀ-Ý][a-zà-ÿ'-]+)/i,
        
        // Nom seul avec majuscule
        /\b([A-ZÀ-Ý][a-zà-ÿ'-]+)\b/
      ];

      for (const pattern of patterns) {
        const match = cleanedMessage.match(pattern);
        if (match && match[1]) {
          const potentialName = match[1].trim();
          
          if (!this.stopWords.includes(potentialName.toLowerCase())) {
            const formattedName = potentialName.charAt(0).toUpperCase() + 
                                potentialName.slice(1).toLowerCase();
            
            logger.info(`Nom extrait: ${formattedName} (via pattern)`);
            return formattedName;
          }
        }
      }

      logger.warn(`Aucun nom valide trouvé dans: "${message}"`);
      return null;

    } catch (error) {
      logger.error(`Erreur extraction nom: ${error.message}`);
      return null;
    }
  }

  extractSubject(message) {
    try {
      const lowerMsg = message.toLowerCase().trim();
      
      for (const [subject, patterns] of Object.entries(this.subjectPatterns)) {
        for (const pattern of patterns) {
          if (lowerMsg.includes(pattern.toLowerCase())) {
            logger.info(`Matière extraite: ${subject} via pattern: ${pattern}`);
            return subject;
          }
        }
      }

      return null;
    } catch (error) {
      logger.error(`Erreur lors de l'extraction de la matière: ${error.message}`);
      return null;
    }
  }

  extractTimeReference(message) {
    try {
      const lowerMsg = message.toLowerCase().trim();
      
      for (const [timeRef, dayOffset] of Object.entries(this.timeReferences)) {
        if (lowerMsg.includes(timeRef)) {
          logger.info(`Référence temporelle extraite: ${timeRef} (offset: ${dayOffset})`);
          return {
            reference: timeRef,
            offset: dayOffset,
            date: this.getDateFromOffset(dayOffset)
          };
        }
      }

      const datePattern = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/;
      const match = lowerMsg.match(datePattern);
      
      if (match) {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;
        const year = match[3] ? parseInt(match[3]) : new Date().getFullYear();
        
        const date = new Date(year < 100 ? 2000 + year : year, month, day);
        logger.info(`Date extraite: ${date.toISOString().split('T')[0]}`);
        
        return {
          reference: 'date_specifique',
          date: date
        };
      }

      return null;
    } catch (error) {
      logger.error(`Erreur lors de l'extraction de la référence temporelle: ${error.message}`);
      return null;
    }
  }

  getDateFromOffset(dayOffset) {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    return date;
  }

  async extractQueryDetails(message) {
    const details = {
      intent: null,
      studentName: null,
      subject: null,
      timeReference: null,
      voiceRequest: false
    };

    try {
      details.voiceRequest = this.isVoiceRequest(message);

      let cleanedMessage = this.cleanVoiceCommands(message);

      details.intent = await this.detectIntent(cleanedMessage);
      
      if (details.intent !== 'greeting') {
        details.studentName = this.extractStudentName(cleanedMessage);
        details.subject = this.extractSubject(cleanedMessage);
        details.timeReference = this.extractTimeReference(cleanedMessage);
      }

      logger.info(`Détails extraits: ${JSON.stringify(details)}`);
      return details;
    } catch (error) {
      logger.error(`Erreur extraction détails: ${error.message}`);
      return details;
    }
  }

  isVoiceRequest(message) {
    const lowerMsg = message.toLowerCase().trim();

    if (this.voicePatterns.startPatterns.some(pattern => pattern.test(lowerMsg))) {
      return true;
    }

    if (this.voicePatterns.endPatterns.some(pattern => pattern.test(lowerMsg))) {
      return true;
    }

    return this.voicePatterns.reading.some(word => lowerMsg.includes(word));
  }

  cleanVoiceCommands(message) {
    let cleaned = message;

    this.voicePatterns.startPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    this.voicePatterns.endPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    return cleaned.trim();
  }
}

module.exports = new NlpHelper();