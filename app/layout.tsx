import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portal de Curso Virtual - Academia de Estudio Bíblico",
  description: "Una plataforma interactiva para el aprendizaje a través de videos, seguimiento de progreso y administración de contenido de cursos.",
  icons: {
    icon: "/logoemaus.png",
    apple: "/logoemaus.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        {children}
      </body>
    </html>
  );
}
