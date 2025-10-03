export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const requestPage = async (url: string) => {
  const response = await fetch(url,
    {
      headers: {
        'x-vercel-debug-proxy-timing': '1',
      },
    }
  );
  return response;
};