const path = require('path');

function withinProfile(profile, value) {
  const relative = path.relative(path.resolve(profile), path.resolve(value));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
function validateIdentity(current, binding) {
  if(current.externalId && binding?.externalId && current.externalId !== binding.externalId) return {state:'identity_mismatch'};
  if(current.state==='connected' && (!/^\d+$/.test(current.externalId||'') || typeof current.name!=='string' || !current.name.trim())) return {state:'connecting'};
  return current;
}
function safeQr(value) {
  return typeof value==='string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value) && value.length<250000 ? value : null;
}
module.exports = {withinProfile, validateIdentity, safeQr};
