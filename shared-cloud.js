/* Uses Firebase after one-time initialization, never writes to the Gist archive. */
(function(root){
 'use strict';
 function create(gistId,fetcher){
  var active=false,started=false,authError=null;
  var legacy=root.AdhesiveGistConnection.create(gistId,fetcher);
  var ready=root.LabFirebaseAuth.ready().catch(function(error){authError=error;});
  function user(){return root.LabFirebaseAuth.user();}
  function level(){return root.LabFirebaseAccess.level(user()?.email);}
  async function token(required){if(!required)return null;await ready;return root.LabFirebaseAuth.getIdToken();}
  var shared=root.AdhesiveFirebaseShared.create({databaseUrl:root.LabFirebaseConfig.databaseURL,fetch:fetcher,getIdToken:token,getUser:user,getRole:level});
  async function read(){
   try{var result=await shared.read();active=true;started=true;await root.LabFirebaseAccess.load();return result;}
   catch(error){if(error.code!=='NOT_INITIALIZED'||active)throw error;started=true;return legacy.read();}
  }
  return {read:read,patch:function(files){if(!active)throw Error('Shared autosave setup is not finished. Open Shared setup.');return shared.patch(files);},
   connect:async function(){await ready;if(authError)throw authError;await root.LabFirebaseSignIn.open();await root.LabFirebaseAccess.load();return user();},
   disconnect:()=>root.LabFirebaseAuth.signOut(),getLogin:()=>user()?.email||'',
   isConnected:()=>Boolean(active&&user()?.emailVerified&&level()!=='none'),canEdit:()=>Boolean(active&&user()?.emailVerified&&['editor','manager','admin'].includes(level())),
   isActive:()=>active,isStarted:()=>started,getUser:user,getLevel:level};
 }
 root.AdhesiveSharedCloud={create:create};
})(globalThis);
