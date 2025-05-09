const { GoogleSpreadsheet } = require('google-spreadsheet');
module.exports = {
  getDoc: async () => {
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
    await doc.useServiceAccountAuth(require(process.env.GOOGLE_CREDENTIALS_PATH));
    await doc.loadInfo();
    return doc;
  },
  getRows: async (sheetName) => {
    const doc = await module.exports.getDoc();
    const sheet = doc.sheetsByTitle[sheetName];
    return sheet ? await sheet.getRows() : [];
  }
};
