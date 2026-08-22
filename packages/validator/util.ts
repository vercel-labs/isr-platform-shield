export const sleep = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

export const requestPage = async (url: string) => {
	const bypass =
		process.env.SHIELD_BYPASS_TOKEN ?? process.env.VERCEL_BYPASS_TOKEN;
	const response = await fetch(url, {
		headers: {
			"x-vercel-debug-proxy-timing": "1",
			...(bypass ? { "x-vercel-protection-bypass": bypass } : {}),
		},
	});
	return response;
};
