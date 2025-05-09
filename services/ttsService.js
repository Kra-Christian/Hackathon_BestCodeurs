const gTTS = require('gtts');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class TTSService {
    constructor() {
        this.audioDir = path.join(__dirname, '../data/audio');
        if (!fs.existsSync(this.audioDir)) {
            fs.mkdirSync(this.audioDir, { recursive: true });
        }
    }

    async generateAudio(text, lang = 'fr') {
        try {
            const filename = `speech_${Date.now()}.mp3`;
            const filepath = path.join(this.audioDir, filename);
            
            return new Promise((resolve, reject) => {
                const gtts = new gTTS(text, lang);
                gtts.save(filepath, (err) => {
                    if (err) {
                        logger.error(`Erreur TTS: ${err}`);
                        reject(err);
                        return;
                    }
                    const audioContent = fs.readFileSync(filepath, { encoding: 'base64' });
                    fs.unlinkSync(filepath);
                    resolve(`data:audio/mp3;base64,${audioContent}`);
                });
            });
        } catch (error) {
            logger.error(`Erreur génération audio: ${error.message}`);
            throw error;
        }
    }

    async textToSpeechStream(text, lang = 'fr') {
        const gtts = new gTTS(text, lang);
        return gtts.stream();
    }
}

module.exports = new TTSService();
