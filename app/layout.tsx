import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SoilSense AI | Soil Image Intelligence",
  description: "Explore visible soil characteristics from an image, with India and Andhra Pradesh context.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
