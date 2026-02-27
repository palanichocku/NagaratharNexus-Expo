// ./src/constants/auditConfig.ts
export const AUDIT_SETTINGS = {
  enabled: true, // Master switch
  levels: {
    PROFILE_APPROVAL: true,
    PROFILE_REVOKE: true,
    ADMIN_LOGIN: true,
    DATA_WIPE: true,
    POST_ANNOUNCEMENT: true,
    CREATE_STAFF_ACCOUNT: true,
    UPDATE_SYSTEM_CONFIG: true,
    PROFILE_UPDATE: false, // Turn off high-frequency logs to save bandwidth
    SEARCH_QUERY: false,   // Only enable for deep analytics
    USER_LOGIN: false
  }
};