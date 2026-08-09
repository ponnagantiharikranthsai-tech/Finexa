import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://finexa.vercel.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/apply/"],
        disallow: [
          "/home",
          "/loans/",
          "/loan-management",
          "/borrowers/",
          "/reports",
          "/capital-management",
          "/applications",
          "/settings",
          "/api/",
          "/_next/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
