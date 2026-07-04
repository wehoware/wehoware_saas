/**
 * Multimedia SEO analysis module.
 *
 * Checks image file names, title attributes, captions,
 * video transcripts, and VideoObject schema.
 */

import { extractImages } from "./utils";

/**
 * Analyze multimedia SEO.
 * @param {string} html
 * @returns {Object}
 */
export function analyzeMultimediaSeo(html) {
  const images = extractImages(html);

  const poorFilenames = images.filter((img) => {
    if (!img.src) return false;
    const filename = img.src.split("/").pop() || "";
    return /^(img\d+|image\d+|photo\d+|screenshot\d+|untitled|dsc_\d+|[\w]{1,3}\d*\.(jpg|png))$/i.test(filename);
  });

  const missingTitles = images.filter((img) => !img.title);
  const poorAltText = images.filter((img) => {
    if (!img.alt) return false;
    return img.alt.length < 3 || img.alt.length > 125 || /^(image|photo|img|picture|screenshot)$/i.test(img.alt);
  });

  // Check for video elements
  const hasVideo = /<video[^>]*>/i.test(html || "") || /youtube\.com|vimeo\.com|dailymotion/i.test(html || "");
  const hasVideoTranscript = /\b(transcript|captions|subtitles)\b/i.test(html || "");
  const hasVideoSchema = /videobject/i.test(html || "");

  // Check for figcaption
  const hasFigcaptions = /<figcaption[^>]*>/i.test(html || "");

  return {
    totalImages: images.length,
    poorFilenames: poorFilenames.length,
    missingTitles: missingTitles.length,
    poorAltText: poorAltText.length,
    hasVideo,
    hasVideoTranscript,
    hasVideoSchema,
    hasFigcaptions,
  };
}

/**
 * Generate issues from multimedia analysis.
 * @param {Object} metrics
 * @returns {Array}
 */
export function multimediaIssues(metrics) {
  const issues = [];

  if (metrics.poorFilenames > 0) {
    issues.push({
      category: "multimedia",
      issueType: "poor_image_filenames",
      severity: "low",
      title: "Non-descriptive image file names",
      description: `${metrics.poorFilenames} image(s) have generic file names (e.g., img001.jpg). Use descriptive names with keywords.`,
      currentValue: `${metrics.poorFilenames} generic filenames`,
      recommendedValue: "Use descriptive filenames with target keywords (e.g., blue-widget-example.jpg)",
    });
  }

  if (metrics.missingTitles > 0 && metrics.totalImages > 0) {
    issues.push({
      category: "multimedia",
      issueType: "missing_image_titles",
      severity: "low",
      title: "Missing image title attributes",
      description: `${metrics.missingTitles} of ${metrics.totalImages} image(s) lack title attributes. Titles improve accessibility and SEO.`,
      currentValue: `${metrics.missingTitles} images without titles`,
      recommendedValue: "Add descriptive title attributes to all images",
    });
  }

  if (metrics.poorAltText > 0) {
    issues.push({
      category: "multimedia",
      issueType: "poor_alt_text",
      severity: "low",
      title: "Unoptimized image alt text",
      description: `${metrics.poorAltText} image(s) have alt text that is too short, too long, or generic. Optimize with descriptive keywords.`,
      currentValue: `${metrics.poorAltText} images with poor alt text`,
      recommendedValue: "Write descriptive alt text (5-100 chars) with relevant keywords",
    });
  }

  if (metrics.hasVideo && !metrics.hasVideoTranscript) {
    issues.push({
      category: "multimedia",
      issueType: "missing_video_transcripts",
      severity: "medium",
      title: "Missing video transcripts",
      description: "Content includes video but no text transcript. Transcripts improve accessibility and SEO.",
      currentValue: "Video without transcript",
      recommendedValue: "Add a text transcript below or alongside the video",
    });
  }

  if (metrics.hasVideo && !metrics.hasVideoSchema) {
    issues.push({
      category: "multimedia",
      issueType: "missing_video_schema",
      severity: "low",
      title: "Missing VideoObject schema",
      description: "Content includes video but lacks VideoObject JSON-LD schema. Adding it enables video rich results.",
      currentValue: "No VideoObject schema",
      recommendedValue: 'Add VideoObject schema with name, description, thumbnailUrl, and uploadDate',
    });
  }

  if (metrics.totalImages > 3 && !metrics.hasFigcaptions) {
    issues.push({
      category: "multimedia",
      issueType: "missing_image_captions",
      severity: "low",
      title: "Missing image captions",
      description: "Content has multiple images but no figcaption elements. Captions improve image SEO.",
      currentValue: "No image captions",
      recommendedValue: "Add <figcaption> elements to important images",
    });
  }

  return issues;
}
