import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { WORKS, displayHost } from './src/ui/works.js';
import { CAPABILITIES } from './src/ui/capabilities.js';

// Absolute site URL for canonical, Open Graph, structured data, robots and
// sitemap. The production site is www.junkbranding.com; override with the
// SITE_URL environment variable (e.g. in Vercel) if that changes.
const SITE_URL = (process.env.SITE_URL || 'https://www.junkbranding.com').replace(/\/+$/, '');
const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// One JSON-LD graph: the studio, the site, this page, what it offers, and
// the works it has made (with their technologies as keywords).
function structuredData() {
  const org = `${SITE_URL}/#organization`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfessionalService',
        '@id': org,
        name: 'JUNKBRANDING',
        alternateName: 'JUNKBRANDING DESIGN STUDIO',
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/apple-touch-icon.png`,
        image: `${SITE_URL}/og.jpg`,
        email: 'hello@junkbranding.com',
        description: 'デザインとテクノロジーを横断し、ブランドの個性をデジタル体験へと変えるクリエイティブチーム。',
        address: { '@type': 'PostalAddress', addressRegion: '茨城県', addressCountry: 'JP' },
        areaServed: { '@type': 'Country', name: '日本' },
        knowsAbout: [...new Set([...CAPABILITIES.flatMap((item) => [item.en, ...item.tags]), ...WORKS.flatMap((work) => work.stack)])],
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'Services',
          itemListElement: CAPABILITIES.map((item) => ({
            '@type': 'Offer',
            itemOffered: { '@type': 'Service', name: item.ja, alternateName: item.en, description: item.desc, provider: { '@id': org } },
          })),
        },
      },
      { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: 'JUNKBRANDING', inLanguage: 'ja', publisher: { '@id': org } },
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/#webpage`,
        url: `${SITE_URL}/`,
        name: 'JUNKBRANDING | Mix the unexpected.',
        inLanguage: 'ja',
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': org },
        primaryImageOfPage: `${SITE_URL}/og.jpg`,
        hasPart: { '@id': `${SITE_URL}/#works` },
      },
      {
        '@type': 'ItemList',
        '@id': `${SITE_URL}/#works`,
        name: 'Selected works',
        itemListElement: WORKS.map((work, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'CreativeWork',
            name: work.nameJa ? `${work.nameJa}（${work.name}）` : work.name,
            url: work.href,
            dateCreated: String(work.year),
            description: work.summary,
            keywords: work.stack.join(', '),
            creator: { '@id': org },
            ...(work.repo ? { sameAs: work.repo } : {}),
          },
        })),
      },
    ],
  };
}

// The same content the scene shows, as plain HTML, so it reads without
// JavaScript or WebGL and every work is reachable for screen readers.
function servicesList() {
  return CAPABILITIES.map((item, index) => `
        <li class="service" tabindex="0"><span class="service__no">${String(index + 1).padStart(2, '0')}</span><span class="service__title">${escape(item.ja)}</span><span class="service__tags">${escape(item.tags.join(' / '))}</span></li>`).join('');
}

function worksIndex() {
  return `<div class="works__index visually-hidden">
          <h3>すべての作品</h3>
          <ol>${WORKS.map((work) => `
            <li>
              <h4><a href="${escape(work.href)}">${escape(work.nameJa ? `${work.nameJa}（${work.name}）` : work.name)}</a></h4>
              <p>${escape(work.summary)}</p>
              <p>${escape(`${work.year}年 / ${work.role}`)}</p>
              <p>使用技術: ${escape(work.stack.join('、'))}</p>
              <ul>${work.highlights.map((line) => `<li>${escape(line)}</li>`).join('')}</ul>
              <p>${escape(displayHost(work.href))}${work.repo ? ` / <a href="${escape(work.repo)}">GitHub</a>` : ''}</p>
            </li>`).join('')}
          </ol>
        </div>`;
}

// The production security headers (vercel.json), also applied by
// `vite preview` so they can be checked locally before deploying.
const securityHeaders = Object.fromEntries(
  JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')).headers[0].headers.map(({ key, value }) => [key, value]),
);
delete securityHeaders['Strict-Transport-Security'];
securityHeaders['Content-Security-Policy'] = securityHeaders['Content-Security-Policy'].replace('; upgrade-insecure-requests', '');

export default defineConfig({
  server: { host: '0.0.0.0' },
  preview: { headers: securityHeaders },
  // Pre-bundle every library up front so the dev server never re-optimises
  // mid-load (which forces a reload and can leave modules or CSS missing).
  optimizeDeps: { include: ['gsap', 'gsap/Observer', 'three', 'three/examples/jsm/misc/GPUComputationRenderer.js', 'three/examples/jsm/postprocessing/AfterimagePass.js', 'three/examples/jsm/postprocessing/EffectComposer.js', 'three/examples/jsm/postprocessing/OutputPass.js', 'three/examples/jsm/postprocessing/RenderPass.js', 'three/examples/jsm/postprocessing/ShaderPass.js', 'three/examples/jsm/postprocessing/UnrealBloomPass.js'] },

  build: { outDir: 'dist', sourcemap: true },
  plugins: [
    {
      name: 'site-content',
      transformIndexHtml: (html) => html
        .replaceAll('__SITE_URL__', SITE_URL)
        .replace('<!--ld-json-->', `<script type="application/ld+json">${JSON.stringify(structuredData())}</script>`)
        .replace('<!--services-list-->', servicesList())
        .replace('<!--works-index-->', worksIndex()),
      generateBundle() {
        const today = new Date().toISOString().slice(0, 10);
        this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n` });
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE_URL}/</loc><lastmod>${today}</lastmod></url>\n</urlset>\n`,
        });
      },
    },
  ],
});
