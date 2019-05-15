function get(state): string {
  return key => state[key] || '';
}

function set(state) {
  return (key: string, value: string) => {
    state[key] = value;
    return this;
  };
}

export {get, set};
