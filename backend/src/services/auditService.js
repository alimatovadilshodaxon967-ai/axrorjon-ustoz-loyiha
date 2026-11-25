const prisma = require('../config/db');

/**
 * Record an audit log entry in SQLite
 */
async function logAudit({
  userId = null,
  action,
  entity,
  entityId = null,
  ipAddress = null,
  userAgent = null,
  details = null,
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId: entityId ? String(entityId) : null,
        ipAddress: ipAddress ? String(ipAddress).substring(0, 45) : null,
        userAgent: userAgent ? String(userAgent).substring(0, 255) : null,
        details: typeof details === 'object' && details !== null ? JSON.stringify(details) : details,
      },
    });
  } catch (error) {
    console.error('AuditLog error:', error.message);
  }
}

module.exports = {
  logAudit,
};
