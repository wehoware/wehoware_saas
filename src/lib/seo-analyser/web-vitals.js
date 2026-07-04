/**
 * Core Web Vitals signals analysis.
 *
 * Checks image dimensions, lazy loading, image format, and
 * render-blocking indicators in HTML content.
 */

import { extractImages } from "./utils";

/**
 * Analyze Core Web Vitals signals from HTML content.
 * @param {string} html
 * @returns {Object}
 */
export function analyzeWebVitals(html) {
  const images = extractImages(html);

  const imagesWithoutDimensions = images.filter(
    (img) => !img.width || !img.height
  );
  const imagesWithoutLazyLoad = images.filter(
    (img) => img.loading !== "lazy"
  );
  const largeImageIndicators = images.filter((img) => {
    if (!img.src) return false;
    return /\.(png|jpg|jpeg|bmp|tiff?)$/i.test(img.src) && !/\.webp$/i.test(img.src);
  });
  const noWebp = images.filter(
    (img) => img.src && !/\.webp$|\.avif$/i.test(img.src)
  );
  const renderBlocking = /<style[^>]*>[\s\S]*?<\/style>|<script(?![^>]*\b(?:async|defer)\b)[^>]*>/gi.test(
    html || ""
  );

  return {
    imagesWithoutDimensions: imagesWithoutDimensions.length,
    imagesWithoutLazyLoad: imagesWithoutLazyLoad.length,
    largeImageIndicators: largeImageIndicators.length,
    noWebpCount: noWebp.length,
    totalImages: images.length,
    hasRenderBlocking: renderBlocking,
  };
}

/**
 * Generate issues from web vitals analysis.
 * @param {Object} metrics
 * @returns {Array}
 */
export function webVitalsIssues(metrics) {
  const issues = [];

  if (metrics.imagesWithoutDimensions > 0) {
    issues.push({
      category: "web_vitals",
      issueType: "images_no_dimensions",
      severity: "medium",
      title: "Images without dimensions",
      description: `${metrics.imagesWithoutDimensions} image(s) lack width/height attributes. This causes Cumulative Layout Shift (CLS).`,
      currentValue: `${metrics.imagesWithoutDimensions} images without dimensions`,
      recommendedValue: "Add width and height attributes to all img tags",
    });
  }

  if (metrics.imagesWithoutLazyLoad > 3) {
    issues.push({
      category: "web_vitals",
      issueType: "no_lazy_loading",
      severity: "low",
      title: "Images not lazy-loaded",
      description: `${metrics.imagesWithoutLazyLoad} image(s) don't use loading="lazy". This increases initial page load time.`,
      currentValue: `${metrics.imagesWithoutLazyLoad} images without lazy loading`,
      recommendedValue: 'Add loading="lazy" to below-the-fold images',
    });
  }

  if (metrics.noWebpCount > 0 && metrics.totalImages > 0) {
    issues.push({
      category: "web_vitals",
      issueType: "no_image_optimization",
      severity: "low",
      title: "Images not optimized for web",
      description: `${metrics.noWebpCount} image(s) use non-optimized formats (PNG/JPG). Consider WebP or AVIF.`,
      currentValue: `${metrics.noWebpCount} non-optimized images`,
      recommendedValue: "Convert images to WebP or AVIF format",
    });
  }

  if (metrics.hasRenderBlocking) {
    issues.push({
      category: "web_vitals",
      issueType: "render_blocking",
      severity: "low",
      title: "Render-blocking resources",
      description: "Inline CSS or non-async scripts detected in content. These block page rendering.",
      currentValue: "Render-blocking resources found",
      recommendedValue: "Use async/defer on scripts and external CSS",
    });
  }

  return issues;
}
