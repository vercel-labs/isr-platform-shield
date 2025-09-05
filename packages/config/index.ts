type Config = {
  [key: string]: {
    api: {
      host: string;
    };
    cacheLayer: {
      host: string;
    };
    core: {
      host: string;
    };
  };
};

export const config: Config = {
  production: {
    api: {
      host: "api.pzvtest314.vercel.app",
    },
    cacheLayer: {
      host: "pzona.lol",
    },
    core: {
      host: "core.pzvtest314.vercel.app",
    },
  },
  development: {
    api: {
      host: "localhost:3002",
    },
    cacheLayer: {
      host: "localhost:3000",
    },
    core: {
      host: "localhost:3001",
    },
  },
};

export const getConfig = (env: string) => {
  return config[env as keyof typeof config];
};
