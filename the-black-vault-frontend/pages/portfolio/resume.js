import fs from 'fs'
import path from 'path'

export async function getServerSideProps({ res }) {
  const sourcePath = path.join(process.cwd(), '..', '..', 'portfolio', 'resume', 'index.html')
  let html = fs.readFileSync(sourcePath, 'utf8')
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
