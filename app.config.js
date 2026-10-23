const fs = require('fs');

module.exports = ({ config }) => {
  // Ưu tiên biến môi trường bí mật từ EAS Build (EAS File Secret / Environment Variable)
  // Nếu chạy local thì fallback về file local ./google-services.json nếu tồn tại
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ||
    (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
