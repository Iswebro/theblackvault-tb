const SOURCE_URL = 'https://raw.githubusercontent.com/Iswebro/theblackvault-tb/portfolio-ai-copywriter/public/portfolio/resume/index.html'

export async function getServerSideProps({ res }) {
  const response = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'Matheus-Neto-Leite-Portfolio' },
  })

  if (!response.ok) {
    throw new Error(`Resume source returned ${response.status}`)
  }

  let html = await response.text()
  html = html.replace('<head>', '<head><base href="/portfolio/resume/">')

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400')
  res.write(html)
  res.end()

  return { props: {} }
}

export default function PortfolioResumePage() {
  return null
}
