const sheet = require('./googleSheetService');

module.exports = {
  getAllParents: async () => {
    return await sheet.getRows("Parents");
  },
  
  getParentByWhatsApp: async (phone) => {
    const rows = await sheet.getRows("Parents");
    return rows.find(r => r['Numéro WhatsApp'] === phone) || null;
  },
  
  getStudentsByParent: async (parentId) => {
    const rows = await sheet.getRows("Élèves");
    return rows.filter(r => r.Parent_ID === parentId);
  },
  
  getStudentById: async (studentId) => {
    const rows = await sheet.getRows("Élèves");
    return rows.find(r => r.ID === studentId) || null;
  },
  
  getStudentGrades: async (studentId) => {
    const rows = await sheet.getRows("Notes");
    return rows.filter(r => r.Élève_ID === studentId);
  },
  
  getStudentAttendance: async (studentId) => {
    const rows = await sheet.getRows("Présences");
    return rows.filter(r => r.Élève_ID === studentId);
  },
  
  getStudentAttendanceByDate: async (studentId, date) => {
    const rows = await sheet.getRows("Présences");
    const dateStr = date.toISOString().split('T')[0];
    
    return rows.filter(r => {
      return r.Élève_ID === studentId && r.Date === dateStr;
    });
  },
  
  getStudentHomework: async (studentId) => {
    const rows = await sheet.getRows("Devoirs");
    return rows.filter(r => r.Élève_ID === studentId);
  },
  
  getStudentHomeworkBySubject: async (studentId, subject) => {
    const rows = await sheet.getRows("Devoirs");
    return rows.filter(r => {
      return r.Élève_ID === studentId && 
             r.Matière.toLowerCase().includes(subject.toLowerCase());
    });
  },
  
  getStudentSchool: async (studentId) => {
    const student = await this.getStudentById(studentId);
    if (!student) return null;
    
    const schools = await sheet.getRows("Écoles");
    if (!schools || !student.École_ID) return null;
    
    return schools.find(s => s.ID === student.École_ID) || null;
  }
};