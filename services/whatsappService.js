const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
module.exports = {
  sendText: (to, text) =>
    client.messages.create({ body: text, from: process.env.TWILIO_WHATSAPP_NUMBER, to }),
  sendAudio: (to, mediaUrl) =>
    client.messages.create({ mediaUrl: [mediaUrl], from: process.env.TWILIO_WHATSAPP_NUMBER, to })
};
