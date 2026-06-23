import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import ToastProvider from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: "CareerNode — AI Job Tracker",
  description: "Local AI-powered job application tracker with Gmail integration and Gemini AI assistant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <div className="app-layout">
            <Sidebar />
            <main className="main-content">
              {children}
            </main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
