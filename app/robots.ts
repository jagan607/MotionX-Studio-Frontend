import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/project/',
          '/admin/',
        ],
      },
    ],
    sitemap: 'https://studio.motionx.in/sitemap.xml',
  }
}
