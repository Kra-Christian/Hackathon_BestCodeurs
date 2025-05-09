module.exports = {
    /**
     * Nettoie un numéro de téléphone en gardant uniquement les chiffres, + et espaces
     * @param {string} phoneNumber - Numéro de téléphone à nettoyer
     * @returns {string} - Numéro de téléphone nettoyé
     */
    cleanPhoneNumber: (phoneNumber) => {
      if (!phoneNumber) return '';
      
      let cleaned = phoneNumber.replace('whatsapp:', '');
      
      return cleaned.replace(/[^\d+]/g, '');
    },
  };