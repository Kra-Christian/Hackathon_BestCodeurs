const data = require('./dataService');
const { cleanPhoneNumber } = require('../utils/securityHelper');
const logger = require('../utils/logger');

module.exports = {
  authenticateParent: async function(phone) {
    return this.verifyUser(phone);
  },
  
  verifyUser: async (phone) => {
    const cleanedPhone = cleanPhoneNumber(phone);
    
    logger.info(`Tentative d'authentification pour le numéro: ${cleanedPhone}`);
    
    const parents = await data.getAllParents();
    
    if (!parents || parents.length === 0) {
      logger.error("Aucun parent trouvé dans la base de données");
      return null;
    }
    
    logger.info(`${parents.length} parents trouvés dans la base de données`);
    
    parents.forEach((p, index) => {
      const phone = p['Numéro WhatsApp'] || 'Non défini';
      logger.info(`Parent #${index+1}: ID=${p.ID}, WhatsApp=${phone}`);
    });
    
    const parent = parents.find(p => {
      if (!p['Numéro WhatsApp']) return false;
      
      const parentPhone = cleanPhoneNumber(p['Numéro WhatsApp']);
      const incomingPhone = cleanPhoneNumber(cleanedPhone);
      
      logger.info(`Comparaison: "${parentPhone}" avec "${incomingPhone}"`);
      
      const parentDigits = parentPhone.replace(/\D/g, '');
      const incomingDigits = incomingPhone.replace(/\D/g, '');
      
      return (
        parentDigits === incomingDigits ||
        parentDigits.slice(-10) === incomingDigits.slice(-10) ||
        parentDigits.slice(-9) === incomingDigits.slice(-9) ||
        parentDigits.slice(-8) === incomingDigits.slice(-8)
      );
    });
    
    if (parent) {
      logger.info(`Authentification réussie pour ${parent.Nom} ${parent.Prénom}, ID: ${parent.ID}`);
    } else {
      logger.warn(`Échec d'authentification pour le numéro: ${cleanedPhone}`);
      
      const incomingDigits = cleanPhoneNumber(cleanedPhone).replace(/\D/g, '');
      logger.info(`Derniers chiffres du numéro entrant: ${incomingDigits.slice(-10)}`);
      
      parents.forEach((p, index) => {
        if (p['Numéro WhatsApp']) {
          const parentDigits = cleanPhoneNumber(p['Numéro WhatsApp']).replace(/\D/g, '');
          logger.info(`Parent #${index+1}: Derniers chiffres: ${parentDigits.slice(-10)}`);
        }
      });
    }
    
    return parent || null;
  }
};