const nlpHelper = require("../utils/nlpHelper");
const auth = require('../services/authService');
const data = require('../services/dataService');
const tts = require('../services/ttsService');
const speechService = require('../services/speechService');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class ChatController {
  constructor() {
    this.sessions = new Map();
    this.responses = {
      greeting: "Bonjour ! Je suis l'assistant de l'école. Je peux vous donner les notes, les absences, les devoirs ou des informations sur l'école. Comment puis-je vous aider ?",
      unauthorized: "Désolé, je ne reconnais pas votre numéro. Contactez l'établissement pour vous assurer que votre numéro est bien enregistré.",
      noGrades: "Aucune note disponible pour {name}.",
      noAttendance: "Aucune information de présence pour {name}.",
      noHomework: "Aucun devoir pour {name}.",
      multipleChildren: "Vous avez plusieurs enfants :\n{list}\nVeuillez préciser lequel (par exemple: \"notes pour [prénom]\")",
      askVoice: "Je vais répondre par message vocal.",
      help: "Voici ce que je peux faire :\n- Consulter les notes (par matière)\n- Vérifier les absences\n- Voir les devoirs\n- Informations sur l'école\nVous pouvez aussi demander une réponse vocale en ajoutant 'en vocal' à votre message."
    };

    this.voiceConfig = {
      tempDir: path.join(__dirname, '../data/temp'),
      supportedCommands: {
        read: /(?:lis|lire|read|vocal|audio)\s+(?:moi|me)?\s+(?:ça|this|la note|the note)?/i,
        voice: /(?:audio|vocal|voix)/i
      }
    };

    if (!fs.existsSync(this.voiceConfig.tempDir)) {
      fs.mkdirSync(this.voiceConfig.tempDir, { recursive: true });
    }
  }

  async handleMessage({ from, body }) {
    try {
      const details = await nlpHelper.extractQueryDetails(body);
      logger.info(`Message traité: ${JSON.stringify(details)}`);

      if (details.intent === 'greeting') {
        return this.responses.greeting;
      }

      if (body.toLowerCase().includes('aide') || body.toLowerCase().includes('help')) {
        return this.responses.help;
      }

      if (!details.studentName && !['greeting', 'help'].includes(details.intent)) {
        return "Je n'ai pas pu identifier le nom de l'élève. Pouvez-vous reformuler avec le prénom ?";
      }

      const wantsVoice = this.voiceConfig.supportedCommands.voice.test(body);
      if (wantsVoice) {
        let session = this.sessions.get(from) || {};
        session.inVoice = true;
        this.sessions.set(from, session);
      }

      switch (details.intent) {
        case 'grades':
          return await this.handleGradesRequest(from, details.studentName, details.subject);
        case 'attendance':
          return await this.handleAttendanceRequest(from, details.studentName, details.timeReference);
        case 'homework':
          return await this.handleHomeworkRequest(from, details.studentName, details.subject);
        case 'school':
          return await this.handleSchoolRequest(from, details.studentName);
        default:
          return "Je n'ai pas compris votre demande. " + this.responses.help;
      }
    } catch (error) {
      logger.error(`Erreur dans handleMessage: ${error.message}`);
      throw error;
    }
  }

  async handleGradesRequest(from, studentName, subject = null) {
    try {
        const parent = await auth.authenticateParent(from);
        if (!parent) {
            logger.warn(`Authentification échouée pour ${from}`);
            return this.responses.unauthorized;
        }

        logger.info(`Parent authentifié: ${parent.ID} demande les notes pour ${studentName}`);

        let session = this.sessions.get(from) || {};
        this.sessions.set(from, session);

        if (session.voiceRequested) {
            session.inVoice = true;
            session.voiceRequested = false;
        }

        return await this.handleGrades(parent, session, studentName, subject);

    } catch (error) {
        logger.error(`Erreur dans handleGradesRequest: ${error.message}`);
        throw error;
    }
}

  async handleAttendanceRequest(from, studentName, timeRef = null) {
    try {
      const parent = await auth.authenticateParent(from);
      if (!parent) {
        return this.responses.unauthorized;
      }

      let session = this.sessions.get(from) || {};
      this.sessions.set(from, session);

      if (session.voiceRequested) {
        session.inVoice = true;
        session.voiceRequested = false;
      }

      if (timeRef) {
        const date = timeRef.date;
        const attendance = await data.getStudentAttendanceByDate(studentId, date);
        return `Présence de ${studentName} ${timeRef.reference}: ${attendance.status}`;
      }
      return await this.handleAttendance(parent, session, studentName);
    } catch (error) {
      logger.error(`Erreur dans handleAttendanceRequest: ${error.message}`);
      throw error;
    }
  }

  async handleHomeworkRequest(from, studentName, subject = null) {
    try {
      const parent = await auth.authenticateParent(from);
      if (!parent) {
        return this.responses.unauthorized;
      }

      let session = this.sessions.get(from) || {};
      this.sessions.set(from, session);

      if (session.voiceRequested) {
        session.inVoice = true;
        session.voiceRequested = false;
      }

      if (subject) {
        const homework = await data.getStudentHomeworkBySubject(studentId, subject);
        return `Devoirs de ${studentName} en ${subject}:\n${homework}`;
      }
      return await this.handleHomework(parent, session, studentName);
    } catch (error) {
      logger.error(`Erreur dans handleHomeworkRequest: ${error.message}`);
      throw error;
    }
  }

  async handleSchoolRequest(from, studentName) {
    try {
      const parent = await auth.authenticateParent(from);
      if (!parent) return this.responses.unauthorized;

      const student = await data.getStudentByName(studentName, parent.ID);
      if (!student) return `Je ne trouve pas d'élève nommé ${studentName}`;

      const school = await data.getStudentSchool(student.ID);
      if (!school) return `Information non disponible pour ${studentName}`;

      return `${studentName} est inscrit(e) à ${school.Nom} en classe de ${student.Classe}`;
    } catch (error) {
      logger.error(`Erreur dans handleSchoolRequest: ${error.message}`);
      throw error;
    }
  }

  async handleVoiceCommand(from) {
    let session = this.sessions.get(from) || {};
    session.voiceRequested = true;
    this.sessions.set(from, session);
    return this.responses.askVoice;
  }

  clearSession(from) {
    if (this.sessions.has(from)) {
      const session = this.sessions.get(from);
      session.selectedChildId = null;
      session.inVoice = false;
      session.voiceRequested = false;
      this.sessions.set(from, session);
    }
  }

  async handleGrades(parent, session, childName, subject = null) {
    logger.info(`Traitement de la demande de notes pour parent ID: ${parent.ID}`);
    
    const subjectsList = {
        'mathematique': ['math', 'mathematique', 'mathematiques', 'maths'],
        'francais': ['francais', 'français', 'fr', 'french'],
        'anglais': ['anglais', 'eng', 'english'],
        'histoire': ['histoire', 'history'],
        'geographie': ['geographie', 'géographie', 'geo'],
        'physique': ['physique', 'physics'],
        'chimie': ['chimie', 'chemistry'],
        'svt': ['svt', 'science', 'biologie'],
    };

    let requestedSubject = subject ? subject : (session.lastMessage ? 
        this.extractSubject(session.lastMessage, subjectsList) : null);
    
    const kids = await data.getStudentsByParent(parent.ID);
    
    if (!kids || kids.length === 0) {
      logger.warn(`Aucun enfant trouvé pour le parent ${parent.ID}`);
      return "Aucun enfant n'est associé à votre compte.";
    }
    
    logger.info(`${kids.length} enfant(s) trouvé(s) pour le parent ${parent.ID}`);
    
    if (kids.length > 1 && !session.selectedChildId && !childName) {
      const list = kids.map(k => `- ${k.Prénom} ${k.Nom}`).join('\n');
      return this.responses.multipleChildren.replace('{list}', list);
    }
    
    let selectedChild = null;
    
    if (childName) {
      selectedChild = kids.find(k => 
        k.Prénom.toLowerCase() === childName.toLowerCase() || 
        k.Nom.toLowerCase() === childName.toLowerCase()
      );
      if (selectedChild) {
        session.selectedChildId = selectedChild.ID;
      }
    } else if (session.selectedChildId) {
      selectedChild = kids.find(k => k.ID === session.selectedChildId);
    } else if (kids.length === 1) {
      selectedChild = kids[0];
      session.selectedChildId = selectedChild.ID;
    }
    
    if (!selectedChild) {
      if (childName) {
        return `Je ne trouve pas d'enfant nommé ${childName} associé à votre compte.`;
      } else {
        return "Veuillez préciser pour quel enfant vous souhaitez voir les notes.";
      }
    }
    
    logger.info(`Récupération des notes pour l'élève ${selectedChild.Prénom} (ID: ${selectedChild.ID})`);
    
    const grades = await data.getStudentGrades(selectedChild.ID);
    
    if (!grades || grades.length === 0) {
      logger.info(`Aucune note trouvée pour l'élève ${selectedChild.ID}`);
      return this.responses.noGrades.replace('{name}', selectedChild.Prénom);
    }
    
    logger.info(`${grades.length} notes trouvées pour l'élève ${selectedChild.ID}`);
    
    let filteredGrades = grades;
    if (requestedSubject) {
        filteredGrades = grades.filter(grade => {
            const subjectLower = grade.Matière.toLowerCase();
            return subjectsList[requestedSubject].some(keyword => subjectLower.includes(keyword));
        });

        if (filteredGrades.length === 0) {
            return `Aucune note disponible en ${requestedSubject} pour ${selectedChild.Prénom}.`;
        }
    }
    
    const gradesPerSubject = {};
    let totalSum = 0;
    let validGradeCount = 0;
    
    filteredGrades.forEach(grade => {
        const note = parseFloat(grade.Note);
        if (!isNaN(note)) {
            if (!gradesPerSubject[grade.Matière]) {
                gradesPerSubject[grade.Matière] = { sum: 0, count: 0 };
            }
            gradesPerSubject[grade.Matière].sum += note;
            gradesPerSubject[grade.Matière].count++;
            totalSum += note;
            validGradeCount++;
        }
    });
    
    let text = `Notes de ${selectedChild.Prénom} ${selectedChild.Nom}`;
    if (requestedSubject) {
        text += ` en ${requestedSubject}`;
    }
    text += ':\n\n';
    
    Object.keys(gradesPerSubject).forEach(subject => {
        const avg = gradesPerSubject[subject].sum / gradesPerSubject[subject].count;
        text += `${subject}: ${avg.toFixed(2)}/20\n`;
    });
    
    if (!requestedSubject) {
        const overallAvg = totalSum / validGradeCount;
        text += `\nMoyenne générale: ${overallAvg.toFixed(2)}/20`;
        
        if (overallAvg >= 16) {
            text += "\nExcellents résultats !";
        } else if (overallAvg >= 14) {
            text += "\nTrès bons résultats.";
        } else if (overallAvg >= 12) {
            text += "\nBons résultats.";
        } else if (overallAvg >= 10) {
            text += "\nRésultats satisfaisants.";
        } else {
            text += "\nDes efforts sont nécessaires pour améliorer ces résultats.";
        }
    }
    
    if (session.inVoice) {
        try {
            let voiceText = `Voici les notes de ${selectedChild.Prénom}. `;
            
            if (requestedSubject) {
                const avg = gradesPerSubject[Object.keys(gradesPerSubject)[0]].sum / 
                           gradesPerSubject[Object.keys(gradesPerSubject)[0]].count;
                voiceText += `En ${requestedSubject}, la moyenne est de ${avg.toFixed(2)} sur 20.`;
            } else {
                Object.entries(gradesPerSubject).forEach(([subject, data]) => {
                    const avg = data.sum / data.count;
                    voiceText += `En ${subject}, la moyenne est de ${avg.toFixed(2)} sur 20. `;
                });
                
                const overallAvg = totalSum / validGradeCount;
                voiceText += `La moyenne générale est de ${overallAvg.toFixed(2)} sur 20.`;
            }

            const audioUrl = await tts.generateAudio(voiceText);
            return {
                text: text,
                mediaUrl: audioUrl
            };
        } catch (error) {
            logger.error(`Erreur génération audio: ${error.message}`);
            return text;
        }
    }
    
    return text;
}

  async handleAttendance(parent, session, childName) {
    logger.info(`Traitement de la demande d'absences pour parent ID: ${parent.ID}`);
    
    const kids = await data.getStudentsByParent(parent.ID);
    
    if (!kids || kids.length === 0) {
      return "Aucun enfant n'est associé à votre compte.";
    }
    
    if (kids.length > 1 && !session.selectedChildId && !childName) {
      const list = kids.map(k => `- ${k.Prénom} ${k.Nom}`).join('\n');
      return this.responses.multipleChildren.replace('{list}', list);
    }
    
    let selectedChild = null;
    
    if (childName) {
      selectedChild = kids.find(k => 
        k.Prénom.toLowerCase() === childName.toLowerCase() || 
        k.Nom.toLowerCase() === childName.toLowerCase()
      );
      if (selectedChild) {
        session.selectedChildId = selectedChild.ID;
      }
    } else if (session.selectedChildId) {
      selectedChild = kids.find(k => k.ID === session.selectedChildId);
    } else if (kids.length === 1) {
      selectedChild = kids[0];
      session.selectedChildId = selectedChild.ID;
    }
    
    if (!selectedChild) {
      if (childName) {
        return `Je ne trouve pas d'enfant nommé ${childName} associé à votre compte.`;
      } else {
        return "Veuillez préciser pour quel enfant vous souhaitez voir les informations de présence.";
      }
    }
    
    const attendance = await data.getStudentAttendance(selectedChild.ID);
    
    if (!attendance || attendance.length === 0) {
      return this.responses.noAttendance.replace('{name}', selectedChild.Prénom);
    }
    
    const sortedAttendance = [...attendance].sort((a, b) => {
      return new Date(b.Date) - new Date(a.Date);
    });
    
    const lastEntry = sortedAttendance[0];
    
    const absences = sortedAttendance.filter(a => a.Statut.toLowerCase() === 'absent');
    
    let text = `Suivi de présence de ${selectedChild.Prénom} ${selectedChild.Nom}:\n\n`;
    text += `Dernière mise à jour: ${lastEntry.Date}\n`;
    text += `Statut actuel: ${lastEntry.Statut}\n`;
    text += `Total des absences: ${absences.length} jour(s)`;
    
    if (session.inVoice) {
      try {
        const simpleText = `${selectedChild.Prénom} est actuellement ${lastEntry.Statut} et totalise ${absences.length} jours d'absence.`;
        const url = await tts.generateAudio(simpleText);
        session.inVoice = false;
        return { text, mediaUrl: url };
      } catch (error) {
        logger.error(`Erreur lors de la génération audio: ${error.message}`);
        session.inVoice = false;
        return { text };
      }
    }
    
    return text;
  }

  async handleHomework(parent, session, childName) {
    logger.info(`Traitement de la demande de devoirs pour parent ID: ${parent.ID}`);
    
    const kids = await data.getStudentsByParent(parent.ID);
    
    if (!kids || kids.length === 0) {
      return "Aucun enfant n'est associé à votre compte.";
    }
    
    if (kids.length > 1 && !session.selectedChildId && !childName) {
      const list = kids.map(k => `- ${k.Prénom} ${k.Nom}`).join('\n');
      return this.responses.multipleChildren.replace('{list}', list);
    }
    
    let selectedChild = null;
    
    if (childName) {
      selectedChild = kids.find(k => 
        k.Prénom.toLowerCase() === childName.toLowerCase() || 
        k.Nom.toLowerCase() === childName.toLowerCase()
      );
      if (selectedChild) {
        session.selectedChildId = selectedChild.ID;
      }
    } else if (session.selectedChildId) {
      selectedChild = kids.find(k => k.ID === session.selectedChildId);
    } else if (kids.length === 1) {
      selectedChild = kids[0];
      session.selectedChildId = selectedChild.ID;
    }
    
    if (!selectedChild) {
      if (childName) {
        return `Je ne trouve pas d'enfant nommé ${childName} associé à votre compte.`;
      } else {
        return "Veuillez préciser pour quel enfant vous souhaitez voir les devoirs.";
      }
    }
    
    const homework = await data.getStudentHomework(selectedChild.ID);
    
    if (!homework || homework.length === 0) {
      return this.responses.noHomework.replace('{name}', selectedChild.Prénom);
    }
    
    const today = new Date();
    const upcomingHomework = homework.filter(hw => {
      const deadline = new Date(hw.Date_Limite);
      return deadline >= today;
    });
    
    const sortedHomework = [...upcomingHomework].sort((a, b) => {
      return new Date(a.Date_Limite) - new Date(b.Date_Limite);
    });
    
    let text = `Devoirs à venir pour ${selectedChild.Prénom} ${selectedChild.Nom}:\n\n`;
    
    if (sortedHomework.length === 0) {
      text = `Aucun devoir à venir pour ${selectedChild.Prénom}.`;
    } else {
      sortedHomework.forEach((hw, index) => {
        text += `${index + 1}. ${hw.Matière}: ${hw.Description}\n`;
        text += `   À rendre pour le: ${hw.Date_Limite}\n\n`;
      });
    }
    
    if (session.inVoice) {
      try {
        let simpleText;
        if (sortedHomework.length === 0) {
          simpleText = `${selectedChild.Prénom} n'a pas de devoirs à venir.`;
        } else {
          const nextHw = sortedHomework[0];
          simpleText = `Le prochain devoir de ${selectedChild.Prénom} est en ${nextHw.Matière}, à rendre pour le ${nextHw.Date_Limite}.`;
        }
        const url = await tts.generateAudio(simpleText);
        session.inVoice = false;
        return { text, mediaUrl: url };
      } catch (error) {
        logger.error(`Erreur lors de la génération audio: ${error.message}`);
        session.inVoice = false;
        return { text };
      }
    }
    
    return text;
  }

  extractChildName(message) {
    const ignoreWords = ['pour', 'de', 'notes', 'note', 'devoir', 'devoirs', 'absence', 'absences', 'mon', 'ma', 'fils', 'fille', 'enfant'];
    
    const words = message.split(/\s+/);
    
    for (const word of words) {
      if (word.length <= 2 || ignoreWords.includes(word.toLowerCase())) {
        continue;
      }
      
      if (/^[A-Z][a-z]+$/.test(word)) {
        return word;
      }
      
      if (/^[a-z]+$/i.test(word) && !ignoreWords.includes(word.toLowerCase())) {
        return word;
      }
    }
    
    return null;
  }

  extractSubject(message, subjectsDict) {
    const messageLower = message.toLowerCase();
    
    for (const [subject, keywords] of Object.entries(subjectsDict)) {
        if (keywords.some(keyword => messageLower.includes(keyword))) {
            return subject;
        }
    }
    
    return null;
  }

  async processMessage(message) {
    try {
        logger.info(
            `Processing message from ${message.from}: ${message.body ? message.body.substring(0, 50) : "Media message"}`
        );

        let response;

        if ((message.hasMedia && message.type === "audio") || message.type === "voice") {
            response = await this.processVoiceMessage(message);
        } else {
            response = await this.processTextMessage(message);
        }

        return response;
    } catch (error) {
        logger.error(`Error processing message: ${error.message}`);
        return {
            text: "Je suis désolé, j'ai rencontré une erreur. Veuillez réessayer.",
            media: null
        };
    }
  }

  async processTextMessage(message) {
    try {
        if (this.voiceConfig.supportedCommands.read.test(message.body)) {
            const commandText = message.body
                .replace(this.voiceConfig.supportedCommands.read, "")
                .trim();

            if (commandText) {
                const noteInfo = await this.fetchNoteInfo(commandText);
                const audioPath = await speechService.textToSpeech(noteInfo, "fr");
                return {
                    text: noteInfo,
                    media: audioPath
                };
            }
        }

        const details = await nlpHelper.extractQueryDetails(message.body);
        return await this.handleMessage({ 
            from: message.from, 
            body: message.body,
            requestVoice: this.voiceConfig.supportedCommands.voice.test(message.body)
        });
    } catch (error) {
        logger.error(`Error processing text message: ${error.message}`);
        throw error;
    }
  }

  async processVoiceMessage(message) {
    try {
        const media = await message.downloadMedia();
        if (!media || !media.data) {
            throw new Error("Failed to download voice message");
        }

        const audioPath = path.join(
            this.voiceConfig.tempDir,
            `voice_${Date.now()}.ogg`
        );

        fs.writeFileSync(audioPath, Buffer.from(media.data, "base64"));

        const command = await speechService.processVoiceCommand(audioPath);
        let response;

        if (command.action === "read") {
            const noteInfo = await this.fetchNoteInfo(command.parameters);
            const responseAudio = await speechService.textToSpeech(noteInfo, "fr");
            response = {
                text: noteInfo,
                media: responseAudio
            };
        } else {
            response = await this.handleMessage({
                from: message.from,
                body: command.parameters,
                requestVoice: true
            });
        }

        fs.unlinkSync(audioPath);
        return response;

    } catch (error) {
        logger.error(`Error processing voice message: ${error.message}`);
        return {
            text: "Désolé, je n'ai pas pu traiter votre message vocal. Veuillez réessayer en texte.",
            media: null
        };
    }
  }

  async fetchNoteInfo(query) {
    try {
        const details = await nlpHelper.extractQueryDetails(query);
        if (details.intent === 'grades') {
            return this.handleGradesRequest(
                null, 
                details.studentName,
                details.subject
            );
        }
        return `Je n'ai pas pu comprendre votre demande de notes.`;
    } catch (error) {
        logger.error(`Error fetching note info: ${error.message}`);
        return `Désolé, je n'ai pas pu trouver les informations demandées.`;
    }
  }
}

module.exports = new ChatController();