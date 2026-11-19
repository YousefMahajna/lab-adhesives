/* Hub-directed UI entry. The hub currently selects emails without verifying ownership. */
(function (root) {
  'use strict';
  var HUB = 'https://yousefmahajna.github.io/interconnect-process-lab/';
  var CONFIG = 'https://api.github.com/repos/YousefMahajna/interconnect-process-lab/contents/platforms.json?ref=main';
  var policyPromise = null;
  function failure(message, code) { var e = new Error(message); e.code = code; return e; }
  function parse(href) {
    var hash = new URLSearchParams(new URL(href).hash.slice(1));
    if (hash.get('ipl-entry') !== '1') return null;
    if (hash.getAll('email').length !== 1 || !hash.get('email').trim()) throw failure('Return to Process Lab and select your NVIDIA email again.', 'INVALID_EMAIL');
    return { email: hash.get('email').trim().toLowerCase() };
  }
  function fromData(email, data, policy) {
    if (!policy.validEmail(email)) throw failure('Return to Process Lab and select a valid NVIDIA email.', 'INVALID_EMAIL');
    if (!data || !Array.isArray(data.access) || !Array.isArray(data.platforms) || !data.platforms.some(function (p) { return p.id === 'adhesives'; })) throw failure('The Process Lab permissions list could not be read. Please try again.', 'INVALID_CONFIG');
    var level = policy.levelFor(email, 'adhesives', data.access);
    if (!level) throw failure('No Adhesive Inventory access is listed for ' + email + '. Ask the Process Lab administrator to update your permissions.', 'NO_ACCESS');
    if (['viewer', 'editor', 'manager', 'admin'].indexOf(level) === -1) throw failure('An unsupported access level was returned. Please contact the Process Lab administrator.', 'INVALID_CONFIG');
    var row = data.access.find(function (r) { return policy.normalize(r.email) === email; });
    var name = policy.isOwner(email) ? policy.ownerRow().name : row && row.name ? String(row.name) : email;
    return { mode: 'hub', email: email, name: name, role: level === 'viewer' ? 'viewer' : 'editor', level: level };
  }
  function loadPolicy() {
    if (root.LabAccess) return Promise.resolve(root.LabAccess);
    if (!policyPromise) {
      policyPromise = new Promise(function (resolve, reject) {
        var script = document.createElement('script'); script.src = HUB + 'access-policy.js?v=adhesives-entry-1';
        var timer = setTimeout(function () { script.remove(); reject(new Error('Process Lab permission rules took too long to load. Try again.')); }, 15000);
        script.onload = function () { clearTimeout(timer); if (root.LabAccess) resolve(root.LabAccess); else reject(new Error('Could not load Process Lab permission rules.')); };
        script.onerror = function () { clearTimeout(timer); script.remove(); reject(new Error('Could not load Process Lab permission rules. Check your connection and try again.')); };
        document.head.appendChild(script);
      }).catch(function (error) { policyPromise = null; throw error; });
    }
    return policyPromise;
  }
  async function load(href, fetcher, getPolicy) {
    var entry = parse(href); if (!entry) return { mode: 'legacy' };
    var policy = await (getPolicy || loadPolicy)();
    if (!policy.validEmail(entry.email)) throw failure('Return to Process Lab and select a valid NVIDIA email.', 'INVALID_EMAIL');
    var response = await fetcher(CONFIG, { cache: 'no-store', redirect: 'error', headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw failure('Could not load current Process Lab permissions. Check your connection and try again.', 'UNAVAILABLE');
    var file = await response.json();
    if (file.encoding !== 'base64' || typeof file.content !== 'string' || file.content.length > 262144) throw failure('The Process Lab permissions file could not be read.', 'INVALID_CONFIG');
    var binary = atob(file.content.replace(/\s/g, ''));
    var data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, function (c) { return c.charCodeAt(0); })));
    return fromData(entry.email, data, policy);
  }
  var api = { HUB: HUB, parse: parse, fromData: fromData, load: load };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AdhesivesHubEntry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
