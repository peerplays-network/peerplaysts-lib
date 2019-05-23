interface IntVerboseObject {
  [index: string]: string;
}

interface IntAccountState {
  loggedIn: boolean;
  roles: string[];
  [key: string]: boolean | string[];
}

interface IntGenKeys {
  accountName: string;
  password: string;
  roles: IntAccountState['roles'];
  prefix?: string;
}

interface IntAuths {
  active: [string][number];
  owner: [string][number];
  memo: [string][number];
  [key: string]: [string][number];
}

interface IntCheckKeys {
  accountName: string;
  password: string;
  auths: IntAuths;
}

