require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const chatController = require('./controllers/chatController');
const whatsappService = require('./services/whatsappService');
const logger = require('./utils/logger');
const speechService = require('./services/speechService');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload({
    createParentPath: true,
    limits: { fileSize: 5 * 1024 * 1024 }
}));

app.get('/', (req, res) => {
    res.send('✅ Serveur UP');
});

app.post('/webhook', async (req, res) => {
    res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    
    try {
        const from = req.body.From;
        let body = req.body.Body ? req.body.Body.trim() : '';
        const numMedia = Number(req.body.NumMedia || 0);

        logger.info(`Requête reçue de ${from}, contenu: "${body}", médias: ${numMedia}`);

        if (numMedia > 0 && req.body.MediaContentType0?.startsWith('audio')) {
            const mediaUrl = req.body.MediaUrl0;
            await handleAudioMessage(from, mediaUrl);
            return;
        }

        await processTextMessage(from, body);

    } catch (error) {
        handleWebhookError(error, req);
    }
});

app.post('/test/tts', async (req, res) => {
    try {
        const { text, language = 'fr' } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Le texte est requis' });
        }

        const audioPath = await speechService.textToSpeech(text, language);
        res.sendFile(audioPath, {}, (err) => {
            if (err) {
                logger.error(`Erreur envoi fichier audio: ${err.message}`);
            }
            fs.unlink(audioPath, (unlinkErr) => {
                if (unlinkErr) logger.error(`Erreur suppression fichier: ${unlinkErr.message}`);
            });
        });

    } catch (error) {
        logger.error(`Erreur test TTS: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

app.post('/test/stt', async (req, res) => {
    try {
        if (!req.files?.audio) {
            return res.status(400).json({ error: 'Fichier audio requis' });
        }

        const audioFile = req.files.audio;
        const tempDir = path.join(__dirname, 'data/temp');
        const tempPath = path.join(tempDir, `audio_${Date.now()}.${audioFile.name.split('.').pop()}`);

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        await audioFile.mv(tempPath);
        const text = await speechService.speechToText(tempPath, req.body.language || 'fr');

        fs.unlinkSync(tempPath);

        res.json({ text });

    } catch (error) {
        logger.error(`Erreur test STT: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

async function handleAudioMessage(from, mediaUrl) {
    await whatsappService.sendText(from, "Je traite votre message vocal, un instant s'il vous plaît...");
    
    try {
        const transcription = await speechService.transcribe(mediaUrl);
        logger.info(`Transcription réussie: "${transcription}"`);
        await processTextMessage(from, transcription);
    } catch (error) {
        logger.error(`Erreur transcription: ${error.message}`);
        await whatsappService.sendText(from, "Désolé, je n'ai pas pu comprendre votre message vocal. Pourriez-vous l'écrire ?");
    }
}

async function processTextMessage(from, body) {
    if (!body?.trim()) {
        await whatsappService.sendText(from, "Je n'ai pas détecté de message. Comment puis-je vous aider ?");
        return;
    }

    try {
        const reply = await chatController.processMessage({ from, body });
        
        if (reply?.mediaUrl) {
            await whatsappService.sendAudio(from, reply.mediaUrl);
            if (reply.text) await whatsappService.sendText(from, reply.text);
        } else if (reply) {
            await whatsappService.sendText(from, reply.text || reply);
        }
    } catch (error) {
        logger.error(`Erreur traitement message: ${error.message}`);
        await whatsappService.sendText(from, "Une erreur est survenue. Veuillez réessayer.");
    }
}

function handleWebhookError(error, req) {
    logger.error(`Erreur webhook: ${error.message}`);
    try {
        if (req.body?.From) {
            whatsappService.sendText(req.body.From, "Une erreur technique est survenue. Veuillez réessayer.");
        }
    } catch (sendError) {
        logger.error(`Erreur envoi message d'erreur: ${sendError.message}`);
    }
}

process.on('uncaughtException', (error) => {
    logger.error(`Erreur non capturée: ${error.message}`);
    logger.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Promesse rejetée non gérée:', reason);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Serveur démarré sur le port ${PORT}`);
    logger.info(`Environnement: ${process.env.NODE_ENV || 'development'}`);
    logger.info('Configuration chargée avec succès');
});