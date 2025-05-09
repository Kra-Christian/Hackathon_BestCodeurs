const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const logger = require("../utils/logger");

class SpeechService {
    constructor() {
        this.tempDir = path.join(__dirname, "../data/temp");
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }

   
        this.assemblyAPI = {
            uploadURL: "https://api.assemblyai.com/v2/upload",
            transcriptURL: "https://api.assemblyai.com/v2/transcript"
        };


        this.apiKey = process.env.ASSEMBLY_API_KEY;

        this.commandPatterns = {
            read: /(?:lis|lire|read)\s+(?:moi|me)?\s+(?:ça|this|la note|the note)?/i,
            grades: /(?:note|notes|bulletin)/i,
            attendance: /(?:absence|présence)/i,
            homework: /(?:devoir|devoirs)/i
        };
    }

    async transcribe(mediaUrl) {
        let tempPath = null;
        
        try {
            const audioData = await this.downloadTwilioAudio(mediaUrl);
            tempPath = path.join(this.tempDir, `audio_${Date.now()}.ogg`);
            fs.writeFileSync(tempPath, audioData);

            const uploadResponse = await this.uploadToAssembly(tempPath);
            
            if (!uploadResponse.upload_url) {
                throw new Error("Échec de l'upload audio");
            }

            const transcriptResponse = await this.requestTranscription(uploadResponse.upload_url);
            
            if (!transcriptResponse.id) {
                throw new Error("Échec de la création de transcription");
            }

            const result = await this.pollTranscriptionResult(transcriptResponse.id);
            return result.text || "Message vocal reçu mais non transcrit";

        } catch (error) {
            logger.error(`Erreur de transcription: ${error.message}`);
            throw new Error("Problème lors de la transcription. Veuillez réessayer.");
        } finally {
            if (tempPath && fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }
    }

    async downloadTwilioAudio(mediaUrl) {
        const response = await axios({
            method: 'get',
            url: mediaUrl,
            responseType: 'arraybuffer',
            auth: {
                username: process.env.TWILIO_ACCOUNT_SID,
                password: process.env.TWILIO_AUTH_TOKEN
            }
        });
        return response.data;
    }

    async uploadToAssembly(filePath) {
        const data = fs.readFileSync(filePath);
        const response = await axios.post(this.assemblyAPI.uploadURL, data, {
            headers: {
                "authorization": this.apiKey,
                "content-type": "application/octet-stream"
            }
        });
        return response.data;
    }

    async requestTranscription(audioUrl) {
        const response = await axios.post(
            this.assemblyAPI.transcriptURL,
            {
                audio_url: audioUrl,
                language_code: "fr"
            },
            {
                headers: {
                    "authorization": this.apiKey,
                    "content-type": "application/json"
                }
            }
        );
        return response.data;
    }

    async pollTranscriptionResult(transcriptId) {
        let attempts = 0;
        const maxAttempts = 30;
        const pollingInterval = 1000;

        while (attempts < maxAttempts) {
            const response = await axios.get(
                `${this.assemblyAPI.transcriptURL}/${transcriptId}`,
                {
                    headers: {
                        "authorization": this.apiKey
                    }
                }
            );

            if (response.data.status === "completed") {
                return response.data;
            }

            if (response.data.status === "error") {
                throw new Error("Erreur de transcription");
            }

            await new Promise(resolve => setTimeout(resolve, pollingInterval));
            attempts++;
        }

        throw new Error("Délai de transcription dépassé");
    }

    async textToSpeech(text, language = "fr") {
        try {
            logger.info(`Conversion texte vers audio: ${text.substring(0, 50)}...`);

            const response = await axios({
                method: "post",
                url: "https://libretranslate.com/api/tts",
                data: {
                    q: text,
                    lang: language,
                },
                responseType: "arraybuffer",
            });

            const audioPath = path.join(this.tempDir, `speech_${Date.now()}.mp3`);
            fs.writeFileSync(audioPath, response.data);

            logger.info(`Conversion texte-parole réussie: ${audioPath}`);
            return audioPath;

        } catch (error) {
            logger.error(`Erreur conversion texte-parole: ${error.message}`);
            throw new Error(`Échec de la conversion texte-parole: ${error.message}`);
        }
    }

    async speechToText(audioPath, language = "fr") {
        try {
            logger.info(`Conversion audio vers texte: ${audioPath}`);

            const formData = new FormData();
            formData.append("file", fs.createReadStream(audioPath));
            formData.append("language", language);

            try {
                const response = await axios.post(
                    "https://voskapi.herokuapp.com/transcribe",
                    formData,
                    { headers: formData.getHeaders() }
                );

                if (response.data?.text) {
                    return response.data.text;
                }
            } catch (error) {
                logger.warn(`Premier service de transcription échoué: ${error.message}`);
            }

            logger.info("Tentative avec service de secours");
            const fallbackForm = new FormData();
            fallbackForm.append("audio", fs.createReadStream(audioPath));

            const fallbackResponse = await axios.post(
                "https://whisper.lablab.ai/asr",
                fallbackForm,
                { headers: fallbackForm.getHeaders() }
            );

            if (fallbackResponse.data?.text) {
                return fallbackResponse.data.text;
            }

            throw new Error("Aucun service de transcription n'a réussi");

        } catch (error) {
            logger.error(`Erreur de transcription: ${error.message}`);
            throw error;
        }
    }

    async processVoiceCommand(audioPath) {
        try {
            const text = await this.speechToText(audioPath);
            logger.info(`Commande vocale détectée: ${text}`);

            if (this.commandPatterns.read.test(text)) {
                return {
                    action: "read",
                    parameters: text.replace(this.commandPatterns.read, "").trim()
                };
            }

            return {
                action: "message",
                parameters: text
            };

        } catch (error) {
            logger.error(`Erreur traitement commande vocale: ${error.message}`);
            throw error;
        }
    }
}

module.exports = new SpeechService();