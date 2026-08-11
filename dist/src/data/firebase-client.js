const FIREBASE_CDN = 'https://www.gstatic.com/firebasejs/12.16.0';
export class FirebaseClient {
  constructor(config) { this.config=config; this.modules=null; this.app=null; this.auth=null; this.db=null; }
  async init() {
    if (this.modules) return this;
    const [appModule, authModule, firestoreModule] = await Promise.all([
      import(`${FIREBASE_CDN}/firebase-app.js`), import(`${FIREBASE_CDN}/firebase-auth.js`), import(`${FIREBASE_CDN}/firebase-firestore.js`)
    ]);
    this.modules={app:appModule,auth:authModule,db:firestoreModule};
    this.app=appModule.initializeApp(stripConfig(this.config));
    this.auth=authModule.getAuth(this.app); this.db=firestoreModule.getFirestore(this.app); return this;
  }
  async ensureSession() {
    await this.init();
    try { await this.modules.auth.getRedirectResult(this.auth); } catch (error) { if (error?.code !== 'auth/no-auth-event') throw error; }
    if (this.auth.currentUser) return normalizeUser(this.auth.currentUser);
    return new Promise((resolve)=>{ const stop=this.modules.auth.onAuthStateChanged(this.auth,(user)=>{stop();resolve(user?normalizeUser(user):null);}); });
  }
  async signInWithGoogle() {
    await this.init();
    const provider=new this.modules.auth.GoogleAuthProvider(); provider.setCustomParameters({prompt:'select_account'});
    try { await this.modules.auth.signInWithPopup(this.auth,provider); return { signedIn: true }; }
    catch(error) { if (['auth/popup-blocked','auth/cancelled-popup-request','auth/operation-not-supported-in-this-environment'].includes(error?.code)) { await this.modules.auth.signInWithRedirect(this.auth,provider); return { redirecting: true }; } throw error; }
  }
  async signOut() { await this.init(); await this.modules.auth.signOut(this.auth); }
  doc(...segments){return this.modules.db.doc(this.db,...segments)}
  collection(...segments){return this.modules.db.collection(this.db,...segments)}
  serverTimestamp(){return this.modules.db.serverTimestamp()}
  async getDoc(ref){return this.modules.db.getDoc(ref)}
  async getDocs(ref){return this.modules.db.getDocs(ref)}
  async setDoc(ref,data,options){return this.modules.db.setDoc(ref,data,options)}
  async updateDoc(ref,data){return this.modules.db.updateDoc(ref,data)}
  async deleteDoc(ref){return this.modules.db.deleteDoc(ref)}
  async runTransaction(fn){return this.modules.db.runTransaction(this.db,fn)}
  onSnapshot(ref,next,error){return this.modules.db.onSnapshot(ref,next,error)}
}
function stripConfig(config){return Object.fromEntries(Object.entries({apiKey:config.apiKey,authDomain:config.authDomain,projectId:config.projectId,appId:config.appId,messagingSenderId:config.messagingSenderId||undefined,storageBucket:config.storageBucket||undefined}).filter(([,v])=>v))}
function normalizeUser(user){return {id:user.uid,uid:user.uid,email:user.email||'',displayName:user.displayName||'',photoURL:user.photoURL||'',user_metadata:{full_name:user.displayName||'',name:user.displayName||'',avatar_url:user.photoURL||''}}}
