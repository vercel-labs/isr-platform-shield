import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { stringToColor } from "@/lib/deployment-id";

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
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID ?? 'local';
  const color = await stringToColor(deploymentId);

  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} antialiased`}>
        <div className="px-3 py-1 text-sm text-background font-bold" style={{ backgroundColor: color }}>
          {deploymentId}
        </div>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
