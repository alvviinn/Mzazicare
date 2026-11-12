// Builds on app.json. Push notifications on Android need the Firebase app file google-services.json.
// It is kept OUTSIDE the project (with the release key) so it never ends up in Git:
//   %LOCALAPPDATA%\mzazicare-deploy\google-services.json   (or the path in MZAZI_GOOGLE_SERVICES)
// Without it the app builds and runs normally, just without push notifications.
const fs = require('fs');
const os = require('os');
const path = require('path');

function googleServicesFile() {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const candidates = [process.env.MZAZI_GOOGLE_SERVICES, path.join(localAppData, 'mzazicare-deploy', 'google-services.json')];
  return candidates.find((f) => f && fs.existsSync(f));
}

module.exports = ({ config }) => {
  const file = googleServicesFile();
  if (file) config.android = { ...config.android, googleServicesFile: file };
  return config;
};
