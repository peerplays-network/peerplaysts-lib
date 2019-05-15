import PrivateKey from '../../ecc/src/PrivateKey';
import key from '../../ecc/src/KeyUtils';

import {get, set} from './state';

let _keyCachePriv: IntVerboseObject, _keyCachePub: IntVerboseObject;

class AccountLogin {
  get: any;
  set: any;
  subs: any;
  constructor() {
    let state: IntAccountState = {
      loggedIn: false,
      roles: ['active', 'owner', 'memo']
    };
    this.get = get(state);
    this.set = set(state);

    this.subs = {};
  }

  addSubscription(cb: string | number) {
    this.subs[cb] = cb;
  }

  setRoles(roles: IntAccountState['roles']) {
    this.set('roles', roles);
  }

  generateKeys(accountName: IntGenKeys['accountName'], password: IntGenKeys['password'], roles: IntGenKeys['roles'], prefix?: IntGenKeys['prefix']) {
    if (!accountName || !password) {
      throw new Error('Account name or password required');
    }

    if (password.length < 12) {
      throw new Error('Password must have at least 12 characters');
    }

    let privKeys: IntVerboseObject = {};
    let pubKeys: IntVerboseObject = {};

    (roles || this.get('roles')).forEach((role) => {
      let seed = password + accountName + role;
      let pkey = _keyCachePriv[seed]
        ? _keyCachePriv[seed]
        : PrivateKey.fromSeed(key.normalize_brainKey(seed));

      _keyCachePriv[seed] = pkey;
      privKeys[role] = pkey;
      pubKeys[role] = _keyCachePub[seed] ? _keyCachePub[seed] : pkey.toPublicKey().toString(prefix);

      _keyCachePub[seed] = pubKeys[role];
    });

    return {privKeys, pubKeys};
  }

  checkKeys({accountName, password, auths}: IntCheckKeys) {
    if (!accountName || !password || !auths) {
      throw new Error('checkKeys: Missing inputs');
    }

    let hasKey = false;
    let roles = Object.keys(auths);

    for (let i = 0, len = roles.length; i < len; i++) {
      let role = roles[i];
      let {privKeys, pubKeys} = this.generateKeys(accountName, password, [role]);
      let entries = Object.entries(auths);
      // TODO: confirm changes do not break
      for (let [key] of entries) {
        if (key === pubKeys[role]) {
          hasKey = true;
          this.set(role, {priv: privKeys[role], pub: pubKeys[role]});
        }
      }
      // auths[role].forEach((roleKey) => {
      //   if (roleKey[0] === pubKeys[role]) {
      //     hasKey = true;
      //     this.set(role, {priv: privKeys[role], pub: pubKeys[role]});
      //   }
      // });
    }

    if (hasKey) {
      this.set('name', accountName);
    }

    this.set('loggedIn', hasKey);

    return hasKey;
  }

  signTransaction(tr) {
    let hasKey = false;

    this.get('roles').forEach((role) => {
      let myKey = this.get(role);

      if (myKey) {
        hasKey = true;
        console.log('adding signer:', myKey.pub);
        tr.add_signer(myKey.priv, myKey.pub);
      }
    });

    if (!hasKey) {
      throw new Error('You do not have any private keys to sign this transaction');
    }
  }
}

export default new AccountLogin();
