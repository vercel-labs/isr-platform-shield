import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { VercelToolbar } from "@vercel/toolbar/next";
import { DeploymentBar } from "@/components/deployment_bar";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Durable ISR Platform POC",
	description: "Durable ISR Platform POC",
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="dark">
			<body className={`${geistSans.variable} antialiased`}>
				<DeploymentBar />
				{children}
				<SpeedInsights />
				<VercelToolbar />
			</body>
		</html>
	);
}
