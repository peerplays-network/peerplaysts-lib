function get(state: IntAccountState) {
  return (key: string) => state[key] || "";
}

function set(state: IntAccountState) {
  return (key: string, value: boolean | Array<string>) => {
    state[key] = value;
    return this;
  };
}

export {get, set};
