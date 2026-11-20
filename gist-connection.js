/* Explicit connection for shared saves. No credential is embedded or persisted. */
(function (root) {
  'use strict';
  function create(gistId, fetcher) {
    if (!/^[a-f0-9]{32}$/i.test(gistId)) throw new Error('Invalid inventory storage ID.');
    var endpoint = 'https://api.github.com/gists/' + gistId, token = '', login = '';
    async function request(url, credential, method, body) {
      var headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
      if (credential) headers.Authorization = 'Bearer ' + credential;
      if (body) headers['Content-Type'] = 'application/json';
      var response;
      try { response = await fetcher(url, { method: method || 'GET', headers: headers, body: body && JSON.stringify(body), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) }); }
      catch (error) { throw new Error(method === 'PATCH' ? 'The save could not be confirmed. Your draft is kept. Reconnect and save again to merge with the latest shared data.' : 'Could not reach GitHub. Your draft is kept. Check your connection and try again.'); }
      if (!response.ok) {
        if ([401, 403, 404].indexOf(response.status) !== -1 && credential) { token = ''; login = ''; }
        var error = new Error(response.status === 401 ? 'GitHub did not accept this credential. Connect again with a valid token.' : response.status === 403 || response.status === 404 ? 'GitHub access was denied. Saving needs the inventory owner account and Gists: Read and write permission.' : 'GitHub returned an error (' + response.status + '). Your draft is kept.');
        error.status = response.status;
        error.rateLimited = response.status === 429 || (response.headers && response.headers.get('x-ratelimit-remaining') === '0');
        throw error;
      }
      return response.json();
    }
    async function publicRead(){
          var base='https://gist.githubusercontent.com/YousefMahajna/'+gistId+'/raw/';
          var response=await fetcher(base+'adhesives_data.json?_='+Date.now(),{method:'GET',headers:{Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
          if(!response.ok)throw new Error('The shared inventory could not be read. No data was changed.');
          var saved=await response.json();
          if(!saved||!Array.isArray(saved.data))throw new Error('The shared inventory format is invalid. No data was changed.');
          var files={'adhesives_data.json':{content:JSON.stringify(saved)}};
          saved.data.forEach(function(row){
            if(row.dsType==='file'&&/^[A-Za-z0-9_-]+$/.test(String(row.id))) {
              var filename='ds_'+row.id+'.json';files[filename]={raw_url:base+filename};
            }
          });
          return {files:files,publicReadFallback:true};
    }
    return {
      read: async function () {
        if(token)return request(endpoint+'?_='+Date.now(),token);
        try{return await publicRead();}catch(error){return request(endpoint+'?_='+Date.now(),'');}
      },
      connect: async function (candidate) {
        token = ''; login = ''; candidate = String(candidate || '').trim();
        if (!candidate) throw new Error('Enter a GitHub token to connect saving.');
        var identity = await request('https://api.github.com/user', candidate);
        var gist = await request(endpoint, candidate);
        if (!gist.owner || gist.owner.id !== identity.id) throw new Error('This GitHub account does not own the shared inventory. Ask the inventory administrator for an authorized saving connection.');
        token = candidate; login = identity.login;
        return { login: login };
      },
      patch: function (files) {
        if (!token) return Promise.reject(new Error('Connect saving before publishing changes. Your browser draft is kept.'));
        return request(endpoint, token, 'PATCH', { files: files });
      },
      disconnect: function () { token = ''; login = ''; },
      isConnected: function () { return Boolean(token); },
      getLogin: function () { return login; }
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { create: create };
  else root.AdhesiveGistConnection = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
