/**
 * privateKeys = IntVerboseObject
 * publicKeys = IntVerboseObject
 * roles = [active, owner, memo]
 * auths = roles.forEach((r) => return {[r][number]})
 */
interface IntVerboseObject {
  [index: string]: string
}

interface IntRoles {
  roles: Array<string>;
}

interface IntAccountState {
  loggedIn: boolean;
  roles: IntRoles['roles'];
}

interface IntGenKeys {
  accountName: string;
  password: string;
  roles: IntRoles['roles'];
  prefix?: string;
}

interface IntAuths {
  active: [string][number];
  owner: [string][number];
  memo: [string][number];
}

interface IntAuthsArray {
  [key: string]: IntAuths
}

interface IntCheckKeys {
  accountName: string;
  password: string;
  auths: IntAuthsArray
}

