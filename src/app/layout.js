import './globals.css'

export const metadata = {
  title: 'Quiniela Mundial 2026',
  description: 'Predice los resultados del Mundial 2026',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {children}
      </body>
    </html>
  )
}