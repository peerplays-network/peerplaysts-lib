interface IntState {
  loggedIn: boolean;
  roles: Array<string>;
}

interface IntGenKeys {
  accountName: string;
  password: string;
  roles: IntState['roles'];
  prefix: string;
}

interface _keyCachePriv {

}

interface _keyCachePub {
  
}
