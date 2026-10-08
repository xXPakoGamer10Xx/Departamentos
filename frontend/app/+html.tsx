import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Este archivo solo se ejecuta en Node.js durante la exportación web para
 * generar el HTML raíz (index.html).
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <title>NethRent</title>

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Metadatos para PWA / Web App en Móviles */}
        <meta name="application-name" content="NethRent" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="NethRent" />
        <meta name="theme-color" content="#0E1321" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Iconos de alta resolución para Apple / iOS */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />

        {/* Favicons e Iconos para Navegadores */}
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512x512.png" />

        {/* Reset de ScrollView para React Native Web */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: resetStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const resetStyles = `
html, body {
  height: 100%;
  background-color: #0E1321;
}
body {
  overflow: hidden;
}
#root {
  display: flex;
  height: 100%;
  flex: 1;
}
`;
